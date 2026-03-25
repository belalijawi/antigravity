#!/usr/bin/env python3
"""
Adds the TahajjudWidget extension target to the Xcode project.
Run once from the ios/ directory:
    python3 add_widget_target.py
"""
import uuid, re, sys, os

PROJECT = "Tahajjud.xcodeproj/project.pbxproj"

if not os.path.exists(PROJECT):
    print(f"Error: Run this script from the ios/ directory (could not find {PROJECT})")
    sys.exit(1)

with open(PROJECT, "r") as f:
    src = f.read()

# Guard against double-run
if "TahajjudWidget" in src:
    print("TahajjudWidget target already present in project.pbxproj — nothing to do.")
    sys.exit(0)

def new_id():
    return uuid.uuid4().hex.upper()[:24]

# ── Generate stable IDs ────────────────────────────────────────────────────────
WIDGET_BUNDLE_ID        = new_id()   # TahajjudWidgetBundle.swift file ref
WIDGET_SWIFT_ID         = new_id()   # TahajjudWidget.swift file ref
WIDGET_ENTITLEMENTS_ID  = new_id()   # TahajjudWidget.entitlements file ref
WIDGET_INFO_ID          = new_id()   # Info.plist file ref
WIDGET_GROUP_ID         = new_id()   # PBXGroup for TahajjudWidget/
WIDGET_TARGET_ID        = new_id()   # PBXNativeTarget
WIDGET_SOURCES_ID       = new_id()   # PBXSourcesBuildPhase
WIDGET_RESOURCES_ID     = new_id()   # PBXResourcesBuildPhase
WIDGET_FRAMEWORKS_ID    = new_id()   # PBXFrameworksBuildPhase
WIDGET_DEBUG_CONFIG_ID  = new_id()   # XCBuildConfiguration Debug
WIDGET_RELEASE_CONFIG_ID = new_id()  # XCBuildConfiguration Release
WIDGET_CONFIG_LIST_ID   = new_id()   # XCConfigurationList
WIDGET_DEPENDENCY_ID    = new_id()   # PBXTargetDependency
WIDGET_CONTAINER_ID     = new_id()   # PBXContainerItemProxy
WIDGET_EMBED_ID         = new_id()   # PBXCopyFilesBuildPhase (embed)
WIDGET_EMBED_FILE_ID    = new_id()   # embed file ref build file
WIDGET_BUNDLE_REF_BF    = new_id()   # PBXBuildFile for bundle .swift
WIDGET_SWIFT_REF_BF     = new_id()   # PBXBuildFile for widget .swift

BUNDLE_ID = "com.tahajjudplus.app.TahajjudWidget"
MIN_IOS   = "16.0"
SWIFT_VER = "5.0"
TEAM_ID   = "$(DEVELOPMENT_TEAM)"

# ── Grab main target's name  ──────────────────────────────────────────────────
main_target_m = re.search(r'([\dA-F]{24})\s*/\* Tahajjud \*/ = \{[^}]+isa = PBXNativeTarget', src)
if not main_target_m:
    print("Could not locate main Tahajjud target. Aborting.")
    sys.exit(1)
MAIN_TARGET_ID = main_target_m.group(1)

# ── 1. PBXBuildFile entries ────────────────────────────────────────────────────
build_files = f"""
\t\t{WIDGET_BUNDLE_REF_BF} /* TahajjudWidgetBundle.swift in Sources */ = {{isa = PBXBuildFile; fileRef = {WIDGET_BUNDLE_ID} /* TahajjudWidgetBundle.swift */; }};
\t\t{WIDGET_SWIFT_REF_BF} /* TahajjudWidget.swift in Sources */ = {{isa = PBXBuildFile; fileRef = {WIDGET_SWIFT_ID} /* TahajjudWidget.swift */; }};
\t\t{WIDGET_EMBED_FILE_ID} /* TahajjudWidget.appex in Embed Foundation Extensions */ = {{isa = PBXBuildFile; fileRef = {WIDGET_TARGET_ID} /* TahajjudWidget.appex */; settings = {{ATTRIBUTES = (RemoveHeadersOnCopy, ); }}; }};"""

src = src.replace("/* End PBXBuildFile section */",
                  build_files + "\n/* End PBXBuildFile section */")

# ── 2. PBXFileReference entries ───────────────────────────────────────────────
file_refs = f"""
\t\t{WIDGET_BUNDLE_ID} /* TahajjudWidgetBundle.swift */ = {{isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = TahajjudWidgetBundle.swift; sourceTree = "<group>"; }};
\t\t{WIDGET_SWIFT_ID} /* TahajjudWidget.swift */ = {{isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = TahajjudWidget.swift; sourceTree = "<group>"; }};
\t\t{WIDGET_ENTITLEMENTS_ID} /* TahajjudWidget.entitlements */ = {{isa = PBXFileReference; lastKnownFileType = text.plist.entitlements; path = TahajjudWidget.entitlements; sourceTree = "<group>"; }};
\t\t{WIDGET_INFO_ID} /* Info.plist */ = {{isa = PBXFileReference; lastKnownFileType = text.plist.xml; path = Info.plist; sourceTree = "<group>"; }};
\t\t{WIDGET_TARGET_ID} /* TahajjudWidget.appex */ = {{isa = PBXFileReference; explicitFileType = "wrapper.app-extension"; includeInIndex = 0; path = TahajjudWidget.appex; sourceTree = BUILT_PRODUCTS_DIR; }};"""

src = src.replace("/* End PBXFileReference section */",
                  file_refs + "\n/* End PBXFileReference section */")

# ── 3. PBXGroup for widget files ──────────────────────────────────────────────
widget_group = f"""
\t\t{WIDGET_GROUP_ID} /* TahajjudWidget */ = {{
\t\t\tisa = PBXGroup;
\t\t\tchildren = (
\t\t\t\t{WIDGET_BUNDLE_ID} /* TahajjudWidgetBundle.swift */,
\t\t\t\t{WIDGET_SWIFT_ID} /* TahajjudWidget.swift */,
\t\t\t\t{WIDGET_ENTITLEMENTS_ID} /* TahajjudWidget.entitlements */,
\t\t\t\t{WIDGET_INFO_ID} /* Info.plist */,
\t\t\t);
\t\t\tname = TahajjudWidget;
\t\t\tpath = TahajjudWidget;
\t\t\tsourceTree = "<group>";
\t\t}};"""

src = src.replace("/* End PBXGroup section */",
                  widget_group + "\n/* End PBXGroup section */")

# Add to main group's children (find the root group that contains "Tahajjud" group reference)
src = re.sub(
    r'(13B07FAE1A68108700A75B9A /\* Tahajjud \*/,)',
    r'\1\n\t\t\t\t' + WIDGET_GROUP_ID + ' /* TahajjudWidget */,',
    src
)

# ── 4. Build phases ───────────────────────────────────────────────────────────
build_phases = f"""
\t\t{WIDGET_SOURCES_ID} /* Sources */ = {{
\t\t\tisa = PBXSourcesBuildPhase;
\t\t\tbuildActionMask = 2147483647;
\t\t\tfiles = (
\t\t\t\t{WIDGET_BUNDLE_REF_BF} /* TahajjudWidgetBundle.swift in Sources */,
\t\t\t\t{WIDGET_SWIFT_REF_BF} /* TahajjudWidget.swift in Sources */,
\t\t\t);
\t\t\trunOnlyForDeploymentPostprocessing = 0;
\t\t}};
\t\t{WIDGET_RESOURCES_ID} /* Resources */ = {{
\t\t\tisa = PBXResourcesBuildPhase;
\t\t\tbuildActionMask = 2147483647;
\t\t\tfiles = (
\t\t\t);
\t\t\trunOnlyForDeploymentPostprocessing = 0;
\t\t}};
\t\t{WIDGET_FRAMEWORKS_ID} /* Frameworks */ = {{
\t\t\tisa = PBXFrameworksBuildPhase;
\t\t\tbuildActionMask = 2147483647;
\t\t\tfiles = (
\t\t\t);
\t\t\trunOnlyForDeploymentPostprocessing = 0;
\t\t}};
\t\t{WIDGET_EMBED_ID} /* Embed Foundation Extensions */ = {{
\t\t\tisa = PBXCopyFilesBuildPhase;
\t\t\tbuildActionMask = 2147483647;
\t\t\tdstPath = "";
\t\t\tdstSubfolderSpec = 13;
\t\t\tfiles = (
\t\t\t\t{WIDGET_EMBED_FILE_ID} /* TahajjudWidget.appex in Embed Foundation Extensions */,
\t\t\t);
\t\t\tname = "Embed Foundation Extensions";
\t\t\trunOnlyForDeploymentPostprocessing = 0;
\t\t}};"""

src = src.replace("/* End PBXCopyFilesBuildPhase section */",
                  "/* End PBXCopyFilesBuildPhase section */")  # keep marker

src = src.replace("/* End PBXSourcesBuildPhase section */",
                  build_phases + "\n/* End PBXSourcesBuildPhase section */")

# ── 5. Target dependency + container item proxy ───────────────────────────────
deps = f"""
\t\t{WIDGET_CONTAINER_ID} /* PBXContainerItemProxy */ = {{
\t\t\tisa = PBXContainerItemProxy;
\t\t\tcontainerPortal = 83CBB9F71A601CBA00E9B192 /* Project object */;
\t\t\tproxyType = 1;
\t\t\tremoteGlobalIDString = {WIDGET_TARGET_ID};
\t\t\tremoteInfo = TahajjudWidget;
\t\t}};
\t\t{WIDGET_DEPENDENCY_ID} /* PBXTargetDependency */ = {{
\t\t\tisa = PBXTargetDependency;
\t\t\ttarget = {WIDGET_TARGET_ID} /* TahajjudWidget */;
\t\t\ttargetProxy = {WIDGET_CONTAINER_ID} /* PBXContainerItemProxy */;
\t\t}};"""

src = src.replace("/* End PBXTargetDependency section */",
                  deps + "\n/* End PBXTargetDependency section */")

# ── 6. Build configurations ───────────────────────────────────────────────────
configs = f"""
\t\t{WIDGET_DEBUG_CONFIG_ID} /* Debug */ = {{
\t\t\tisa = XCBuildConfiguration;
\t\t\tbuildSettings = {{
\t\t\t\tCODE_SIGN_ENTITLEMENTS = TahajjudWidget/TahajjudWidget.entitlements;
\t\t\t\tCODE_SIGN_STYLE = Automatic;
\t\t\t\tCURRENT_PROJECT_VERSION = 1;
\t\t\t\tDEVELOPMENT_TEAM = {TEAM_ID};
\t\t\t\tGENERATE_INFOPLIST_FILE = NO;
\t\t\t\tINFOPLIST_FILE = TahajjudWidget/Info.plist;
\t\t\t\tIPHONEOS_DEPLOYMENT_TARGET = {MIN_IOS};
\t\t\t\tMARKETING_VERSION = 1.0;
\t\t\t\tPRODUCT_BUNDLE_IDENTIFIER = {BUNDLE_ID};
\t\t\t\tPRODUCT_NAME = "$(TARGET_NAME)";
\t\t\t\tSKIP_INSTALL = YES;
\t\t\t\tSWIFT_EMIT_LOC_STRINGS = YES;
\t\t\t\tSWIFT_VERSION = {SWIFT_VER};
\t\t\t\tTARGETED_DEVICE_FAMILY = "1,2";
\t\t\t}};
\t\t\tname = Debug;
\t\t}};
\t\t{WIDGET_RELEASE_CONFIG_ID} /* Release */ = {{
\t\t\tisa = XCBuildConfiguration;
\t\t\tbuildSettings = {{
\t\t\t\tCODE_SIGN_ENTITLEMENTS = TahajjudWidget/TahajjudWidget.entitlements;
\t\t\t\tCODE_SIGN_STYLE = Automatic;
\t\t\t\tCURRENT_PROJECT_VERSION = 1;
\t\t\t\tDEVELOPMENT_TEAM = {TEAM_ID};
\t\t\t\tGENERATE_INFOPLIST_FILE = NO;
\t\t\t\tINFOPLIST_FILE = TahajjudWidget/Info.plist;
\t\t\t\tIPHONEOS_DEPLOYMENT_TARGET = {MIN_IOS};
\t\t\t\tMARKETING_VERSION = 1.0;
\t\t\t\tPRODUCT_BUNDLE_IDENTIFIER = {BUNDLE_ID};
\t\t\t\tPRODUCT_NAME = "$(TARGET_NAME)";
\t\t\t\tSKIP_INSTALL = YES;
\t\t\t\tSWIFT_EMIT_LOC_STRINGS = YES;
\t\t\t\tSWIFT_VERSION = {SWIFT_VER};
\t\t\t\tTARGETED_DEVICE_FAMILY = "1,2";
\t\t\t}};
\t\t\tname = Release;
\t\t}};"""

src = src.replace("/* End XCBuildConfiguration section */",
                  configs + "\n/* End XCBuildConfiguration section */")

# ── 7. Configuration list ─────────────────────────────────────────────────────
config_list = f"""
\t\t{WIDGET_CONFIG_LIST_ID} /* Build configuration list for PBXNativeTarget "TahajjudWidget" */ = {{
\t\t\tisa = XCConfigurationList;
\t\t\tbuildConfigurations = (
\t\t\t\t{WIDGET_DEBUG_CONFIG_ID} /* Debug */,
\t\t\t\t{WIDGET_RELEASE_CONFIG_ID} /* Release */,
\t\t\t);
\t\t\tdefaultConfigurationIsVisible = 0;
\t\t\tdefaultConfigurationName = Release;
\t\t}};"""

src = src.replace("/* End XCConfigurationList section */",
                  config_list + "\n/* End XCConfigurationList section */")

# ── 8. Native target ──────────────────────────────────────────────────────────
native_target = f"""
\t\t{WIDGET_TARGET_ID} /* TahajjudWidget */ = {{
\t\t\tisa = PBXNativeTarget;
\t\t\tbuildConfigurationList = {WIDGET_CONFIG_LIST_ID} /* Build configuration list for PBXNativeTarget "TahajjudWidget" */;
\t\t\tbuildPhases = (
\t\t\t\t{WIDGET_SOURCES_ID} /* Sources */,
\t\t\t\t{WIDGET_FRAMEWORKS_ID} /* Frameworks */,
\t\t\t\t{WIDGET_RESOURCES_ID} /* Resources */,
\t\t\t);
\t\t\tbuildRules = (
\t\t\t);
\t\t\tdependencies = (
\t\t\t);
\t\t\tname = TahajjudWidget;
\t\t\tproductName = TahajjudWidget;
\t\t\tproductReference = {WIDGET_TARGET_ID} /* TahajjudWidget.appex */;
\t\t\tproductType = "com.apple.product-type.app-extension";
\t\t}};"""

src = src.replace("/* End PBXNativeTarget section */",
                  native_target + "\n/* End PBXNativeTarget section */")

# ── 9. Add target to project targets list ────────────────────────────────────
src = re.sub(
    r'(targets = \([^)]+)(13B07F961A680F5B00A75B9A /\* Tahajjud \*/,)',
    r'\g<1>\g<2>\n\t\t\t\t' + WIDGET_TARGET_ID + ' /* TahajjudWidget */,',
    src
)

# ── 10. Add embed phase to main target ───────────────────────────────────────
# Add widget dependency to main target's dependencies list
src = re.sub(
    r'(13B07F961A680F5B00A75B9A /\* Tahajjud \*/ = \{[^}]*?dependencies = \()',
    r'\g<1>\n\t\t\t\t' + WIDGET_DEPENDENCY_ID + ' /* PBXTargetDependency */,',
    src,
    flags=re.DOTALL
)

# Add embed copy phase to main target's build phases
src = re.sub(
    r'(13B07F961A680F5B00A75B9A /\* Tahajjud \*/ = \{[^}]*?buildPhases = \([^)]*?)(\);)',
    r'\g<1>\t\t\t\t' + WIDGET_EMBED_ID + ' /* Embed Foundation Extensions */,\n\t\t\t\t\g<2>',
    src,
    flags=re.DOTALL
)

# ── Write back ────────────────────────────────────────────────────────────────
with open(PROJECT, "w") as f:
    f.write(src)

print("✅ TahajjudWidget target added to project.pbxproj successfully!")
print()
print("Next steps:")
print("  1. Open Tahajjud.xcworkspace in Xcode")
print("  2. Select the TahajjudWidget target → Signing & Capabilities")
print("  3. Set your Team and enable 'App Groups' → add 'group.com.tahajjudplus.app'")
print("  4. Do the same for the Tahajjud main target (App Groups capability)")
print("  5. Build & run")
