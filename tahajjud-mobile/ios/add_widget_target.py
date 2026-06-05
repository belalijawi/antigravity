#!/usr/bin/env python3
"""
Adds the TahajjudWidget extension target to Tahajjud.xcodeproj/project.pbxproj.
Run once from the ios/ directory:
    python3 add_widget_target.py
"""
import uuid, os, sys

PROJECT = "Tahajjud.xcodeproj/project.pbxproj"

if not os.path.exists(PROJECT):
    print(f"Error: run this script from the ios/ directory (could not find {PROJECT})")
    sys.exit(1)

with open(PROJECT, "r") as f:
    src = f.read()

if "TahajjudWidget" in src:
    print("TahajjudWidget already present in project.pbxproj — nothing to do.")
    sys.exit(0)

def uid():
    return uuid.uuid4().hex.upper()[:24]

# ── Stable IDs ────────────────────────────────────────────────────────────────
BUNDLE_BF          = uid()   # PBXBuildFile: TahajjudWidgetBundle.swift in Sources
SWIFT_BF           = uid()   # PBXBuildFile: TahajjudWidget.swift in Sources
EMBED_BF           = uid()   # PBXBuildFile: TahajjudWidget.appex in Embed Extensions

BUNDLE_REF         = uid()   # PBXFileReference: TahajjudWidgetBundle.swift
SWIFT_REF          = uid()   # PBXFileReference: TahajjudWidget.swift
ENTITLEMENTS_REF   = uid()   # PBXFileReference: TahajjudWidget.entitlements
INFO_REF           = uid()   # PBXFileReference: Info.plist
APPEX_REF          = uid()   # PBXFileReference: TahajjudWidget.appex (product)

WIDGET_GROUP       = uid()   # PBXGroup: TahajjudWidget/

WIDGET_TARGET      = uid()   # PBXNativeTarget: TahajjudWidget
SOURCES_PHASE      = uid()   # PBXSourcesBuildPhase (widget)
FRAMEWORKS_PHASE   = uid()   # PBXFrameworksBuildPhase (widget)
RESOURCES_PHASE    = uid()   # PBXResourcesBuildPhase (widget)
EMBED_PHASE        = uid()   # PBXCopyFilesBuildPhase: Embed Foundation Extensions

PROXY              = uid()   # PBXContainerItemProxy
DEPENDENCY         = uid()   # PBXTargetDependency

DEBUG_CONFIG       = uid()   # XCBuildConfiguration: Debug (widget)
RELEASE_CONFIG     = uid()   # XCBuildConfiguration: Release (widget)
CONFIG_LIST        = uid()   # XCConfigurationList (widget)

# ── Known IDs from the project file ──────────────────────────────────────────
MAIN_TARGET        = "13B07F861A680F5B00A75B9A"   # PBXNativeTarget "Tahajjud"
ROOT_GROUP         = "83CBB9F61A601CBA00E9B192"   # root PBXGroup
PRODUCTS_GROUP     = "83CBBA001A601CBA00E9B192"   # Products PBXGroup
PROJECT_OBJ        = "83CBB9F71A601CBA00E9B192"   # PBXProject
TEAM               = "73Y2B8DNY2"
BUNDLE_ID          = "com.tahajjudplus.app.widget"
MIN_IOS            = "16.0"

# ══════════════════════════════════════════════════════════════════════════════
# 1. PBXBuildFile entries
# ══════════════════════════════════════════════════════════════════════════════
build_files = f"""\t\t{BUNDLE_BF} /* TahajjudWidgetBundle.swift in Sources */ = {{isa = PBXBuildFile; fileRef = {BUNDLE_REF} /* TahajjudWidgetBundle.swift */; }};
\t\t{SWIFT_BF} /* TahajjudWidget.swift in Sources */ = {{isa = PBXBuildFile; fileRef = {SWIFT_REF} /* TahajjudWidget.swift */; }};
\t\t{EMBED_BF} /* TahajjudWidget.appex in Embed Foundation Extensions */ = {{isa = PBXBuildFile; fileRef = {APPEX_REF} /* TahajjudWidget.appex */; settings = {{ATTRIBUTES = (RemoveHeadersOnCopy, ); }}; }};
"""
src = src.replace(
    "/* End PBXBuildFile section */",
    build_files + "/* End PBXBuildFile section */"
)

# ══════════════════════════════════════════════════════════════════════════════
# 2. PBXContainerItemProxy + PBXCopyFilesBuildPhase sections (new sections)
#    Insert between PBXBuildFile and PBXFileReference sections
# ══════════════════════════════════════════════════════════════════════════════
new_sections_1 = f"""
/* Begin PBXContainerItemProxy section */
\t\t{PROXY} /* PBXContainerItemProxy */ = {{
\t\t\tisa = PBXContainerItemProxy;
\t\t\tcontainerPortal = {PROJECT_OBJ} /* Project object */;
\t\t\tproxyType = 1;
\t\t\tremoteGlobalIDString = {WIDGET_TARGET};
\t\t\tremoteInfo = TahajjudWidget;
\t\t}};
/* End PBXContainerItemProxy section */

/* Begin PBXCopyFilesBuildPhase section */
\t\t{EMBED_PHASE} /* Embed Foundation Extensions */ = {{
\t\t\tisa = PBXCopyFilesBuildPhase;
\t\t\tbuildActionMask = 2147483647;
\t\t\tdstPath = "";
\t\t\tdstSubfolderSpec = 13;
\t\t\tfiles = (
\t\t\t\t{EMBED_BF} /* TahajjudWidget.appex in Embed Foundation Extensions */,
\t\t\t);
\t\t\tname = "Embed Foundation Extensions";
\t\t\trunOnlyForDeploymentPostprocessing = 0;
\t\t}};
/* End PBXCopyFilesBuildPhase section */

"""
src = src.replace(
    "/* Begin PBXFileReference section */",
    new_sections_1 + "/* Begin PBXFileReference section */"
)

# ══════════════════════════════════════════════════════════════════════════════
# 3. PBXFileReference entries
# ══════════════════════════════════════════════════════════════════════════════
file_refs = f"""\t\t{BUNDLE_REF} /* TahajjudWidgetBundle.swift */ = {{isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = TahajjudWidgetBundle.swift; sourceTree = "<group>"; }};
\t\t{SWIFT_REF} /* TahajjudWidget.swift */ = {{isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = TahajjudWidget.swift; sourceTree = "<group>"; }};
\t\t{ENTITLEMENTS_REF} /* TahajjudWidget.entitlements */ = {{isa = PBXFileReference; lastKnownFileType = text.plist.entitlements; path = TahajjudWidget.entitlements; sourceTree = "<group>"; }};
\t\t{INFO_REF} /* Info.plist */ = {{isa = PBXFileReference; lastKnownFileType = text.plist.xml; path = Info.plist; sourceTree = "<group>"; }};
\t\t{APPEX_REF} /* TahajjudWidget.appex */ = {{isa = PBXFileReference; explicitFileType = "wrapper.app-extension"; includeInIndex = 0; path = TahajjudWidget.appex; sourceTree = BUILT_PRODUCTS_DIR; }};
"""
src = src.replace(
    "/* End PBXFileReference section */",
    file_refs + "/* End PBXFileReference section */"
)

# ══════════════════════════════════════════════════════════════════════════════
# 4. Add .appex to Products group children
# ══════════════════════════════════════════════════════════════════════════════
src = src.replace(
    f"{PRODUCTS_GROUP} /* Products */ = {{\n\t\t\tisa = PBXGroup;\n\t\t\tchildren = (\n\t\t\t\t13B07F961A680F5B00A75B9A /* Tahajjud.app */,",
    f"{PRODUCTS_GROUP} /* Products */ = {{\n\t\t\tisa = PBXGroup;\n\t\t\tchildren = (\n\t\t\t\t13B07F961A680F5B00A75B9A /* Tahajjud.app */,\n\t\t\t\t{APPEX_REF} /* TahajjudWidget.appex */,"
)

# ══════════════════════════════════════════════════════════════════════════════
# 5. PBXGroup for widget files + add to root group
# ══════════════════════════════════════════════════════════════════════════════
widget_group = f"""\t\t{WIDGET_GROUP} /* TahajjudWidget */ = {{
\t\t\tisa = PBXGroup;
\t\t\tchildren = (
\t\t\t\t{BUNDLE_REF} /* TahajjudWidgetBundle.swift */,
\t\t\t\t{SWIFT_REF} /* TahajjudWidget.swift */,
\t\t\t\t{ENTITLEMENTS_REF} /* TahajjudWidget.entitlements */,
\t\t\t\t{INFO_REF} /* Info.plist */,
\t\t\t);
\t\t\tname = TahajjudWidget;
\t\t\tpath = TahajjudWidget;
\t\t\tsourceTree = "<group>";
\t\t}};
"""
src = src.replace(
    "/* End PBXGroup section */",
    widget_group + "/* End PBXGroup section */"
)

# Add widget group to root group's children
src = src.replace(
    f"\t\t\t\t13B07FAE1A68108700A75B9A /* Tahajjud */,",
    f"\t\t\t\t13B07FAE1A68108700A75B9A /* Tahajjud */,\n\t\t\t\t{WIDGET_GROUP} /* TahajjudWidget */,"
)

# ══════════════════════════════════════════════════════════════════════════════
# 6. PBXNativeTarget for widget
# ══════════════════════════════════════════════════════════════════════════════
widget_target = f"""\t\t{WIDGET_TARGET} /* TahajjudWidget */ = {{
\t\t\tisa = PBXNativeTarget;
\t\t\tbuildConfigurationList = {CONFIG_LIST} /* Build configuration list for PBXNativeTarget "TahajjudWidget" */;
\t\t\tbuildPhases = (
\t\t\t\t{SOURCES_PHASE} /* Sources */,
\t\t\t\t{FRAMEWORKS_PHASE} /* Frameworks */,
\t\t\t\t{RESOURCES_PHASE} /* Resources */,
\t\t\t);
\t\t\tbuildRules = (
\t\t\t);
\t\t\tdependencies = (
\t\t\t);
\t\t\tname = TahajjudWidget;
\t\t\tproductName = TahajjudWidget;
\t\t\tproductReference = {APPEX_REF} /* TahajjudWidget.appex */;
\t\t\tproductType = "com.apple.product-type.app-extension";
\t\t}};
"""
src = src.replace(
    "/* End PBXNativeTarget section */",
    widget_target + "/* End PBXNativeTarget section */"
)

# ══════════════════════════════════════════════════════════════════════════════
# 7. Add embed phase + dependency to main target
# ══════════════════════════════════════════════════════════════════════════════
# Add embed phase to main target's buildPhases
src = src.replace(
    f"\t\t\t\tF4CBC5023F3FBFBA926685B8 /* [CP] Embed Pods Frameworks */,\n\t\t\t);\n\t\t\tbuildRules = (\n\t\t\t);\n\t\t\tdependencies = (\n\t\t\t);",
    f"\t\t\t\tF4CBC5023F3FBFBA926685B8 /* [CP] Embed Pods Frameworks */,\n\t\t\t\t{EMBED_PHASE} /* Embed Foundation Extensions */,\n\t\t\t);\n\t\t\tbuildRules = (\n\t\t\t);\n\t\t\tdependencies = (\n\t\t\t\t{DEPENDENCY} /* PBXTargetDependency */,\n\t\t\t);"
)

# ══════════════════════════════════════════════════════════════════════════════
# 8. PBXTargetDependency section (new) — insert before PBXProject section
# ══════════════════════════════════════════════════════════════════════════════
target_dep = f"""/* Begin PBXTargetDependency section */
\t\t{DEPENDENCY} /* PBXTargetDependency */ = {{
\t\t\tisa = PBXTargetDependency;
\t\t\ttarget = {WIDGET_TARGET} /* TahajjudWidget */;
\t\t\ttargetProxy = {PROXY} /* PBXContainerItemProxy */;
\t\t}};
/* End PBXTargetDependency section */

"""
src = src.replace(
    "/* Begin PBXProject section */",
    target_dep + "/* Begin PBXProject section */"
)

# ══════════════════════════════════════════════════════════════════════════════
# 9. Widget frameworks, resources, sources build phases
# ══════════════════════════════════════════════════════════════════════════════
widget_fw_phase = f"""\t\t{FRAMEWORKS_PHASE} /* Frameworks */ = {{
\t\t\tisa = PBXFrameworksBuildPhase;
\t\t\tbuildActionMask = 2147483647;
\t\t\tfiles = (
\t\t\t);
\t\t\trunOnlyForDeploymentPostprocessing = 0;
\t\t}};
"""
src = src.replace(
    "/* End PBXFrameworksBuildPhase section */",
    widget_fw_phase + "/* End PBXFrameworksBuildPhase section */"
)

widget_res_phase = f"""\t\t{RESOURCES_PHASE} /* Resources */ = {{
\t\t\tisa = PBXResourcesBuildPhase;
\t\t\tbuildActionMask = 2147483647;
\t\t\tfiles = (
\t\t\t);
\t\t\trunOnlyForDeploymentPostprocessing = 0;
\t\t}};
"""
src = src.replace(
    "/* End PBXResourcesBuildPhase section */",
    widget_res_phase + "/* End PBXResourcesBuildPhase section */"
)

widget_src_phase = f"""\t\t{SOURCES_PHASE} /* Sources */ = {{
\t\t\tisa = PBXSourcesBuildPhase;
\t\t\tbuildActionMask = 2147483647;
\t\t\tfiles = (
\t\t\t\t{BUNDLE_BF} /* TahajjudWidgetBundle.swift in Sources */,
\t\t\t\t{SWIFT_BF} /* TahajjudWidget.swift in Sources */,
\t\t\t);
\t\t\trunOnlyForDeploymentPostprocessing = 0;
\t\t}};
"""
src = src.replace(
    "/* End PBXSourcesBuildPhase section */",
    widget_src_phase + "/* End PBXSourcesBuildPhase section */"
)

# ══════════════════════════════════════════════════════════════════════════════
# 10. XCBuildConfiguration entries for widget
# ══════════════════════════════════════════════════════════════════════════════
build_configs = f"""\t\t{DEBUG_CONFIG} /* Debug */ = {{
\t\t\tisa = XCBuildConfiguration;
\t\t\tbuildSettings = {{
\t\t\t\tCODE_SIGN_ENTITLEMENTS = TahajjudWidget/TahajjudWidget.entitlements;
\t\t\t\tCODE_SIGN_STYLE = Automatic;
\t\t\t\tCURRENT_PROJECT_VERSION = 1;
\t\t\t\tDEVELOPMENT_TEAM = {TEAM};
\t\t\t\tGENERATE_INFOPLIST_FILE = NO;
\t\t\t\tINFOPLIST_FILE = TahajjudWidget/Info.plist;
\t\t\t\tIPHONEOS_DEPLOYMENT_TARGET = {MIN_IOS};
\t\t\t\tMARKETING_VERSION = 1.0;
\t\t\t\tPRODUCT_BUNDLE_IDENTIFIER = {BUNDLE_ID};
\t\t\t\tPRODUCT_NAME = "$(TARGET_NAME)";
\t\t\t\tSKIP_INSTALL = YES;
\t\t\t\tSWIFT_EMIT_LOC_STRINGS = YES;
\t\t\t\tSWIFT_VERSION = 5.0;
\t\t\t\tTARGETED_DEVICE_FAMILY = "1,2";
\t\t\t}};
\t\t\tname = Debug;
\t\t}};
\t\t{RELEASE_CONFIG} /* Release */ = {{
\t\t\tisa = XCBuildConfiguration;
\t\t\tbuildSettings = {{
\t\t\t\tCODE_SIGN_ENTITLEMENTS = TahajjudWidget/TahajjudWidget.entitlements;
\t\t\t\tCODE_SIGN_STYLE = Automatic;
\t\t\t\tCURRENT_PROJECT_VERSION = 1;
\t\t\t\tDEVELOPMENT_TEAM = {TEAM};
\t\t\t\tGENERATE_INFOPLIST_FILE = NO;
\t\t\t\tINFOPLIST_FILE = TahajjudWidget/Info.plist;
\t\t\t\tIPHONEOS_DEPLOYMENT_TARGET = {MIN_IOS};
\t\t\t\tMARKETING_VERSION = 1.0;
\t\t\t\tPRODUCT_BUNDLE_IDENTIFIER = {BUNDLE_ID};
\t\t\t\tPRODUCT_NAME = "$(TARGET_NAME)";
\t\t\t\tSKIP_INSTALL = YES;
\t\t\t\tSWIFT_EMIT_LOC_STRINGS = YES;
\t\t\t\tSWIFT_VERSION = 5.0;
\t\t\t\tTARGETED_DEVICE_FAMILY = "1,2";
\t\t\t}};
\t\t\tname = Release;
\t\t}};
"""
src = src.replace(
    "/* End XCBuildConfiguration section */",
    build_configs + "/* End XCBuildConfiguration section */"
)

# ══════════════════════════════════════════════════════════════════════════════
# 11. XCConfigurationList for widget
# ══════════════════════════════════════════════════════════════════════════════
config_list = f"""\t\t{CONFIG_LIST} /* Build configuration list for PBXNativeTarget "TahajjudWidget" */ = {{
\t\t\tisa = XCConfigurationList;
\t\t\tbuildConfigurations = (
\t\t\t\t{DEBUG_CONFIG} /* Debug */,
\t\t\t\t{RELEASE_CONFIG} /* Release */,
\t\t\t);
\t\t\tdefaultConfigurationIsVisible = 0;
\t\t\tdefaultConfigurationName = Release;
\t\t}};
"""
src = src.replace(
    "/* End XCConfigurationList section */",
    config_list + "/* End XCConfigurationList section */"
)

# ══════════════════════════════════════════════════════════════════════════════
# 12. Add widget target to project targets list
# ══════════════════════════════════════════════════════════════════════════════
src = src.replace(
    f"\t\t\ttargets = (\n\t\t\t\t{MAIN_TARGET} /* Tahajjud */,",
    f"\t\t\ttargets = (\n\t\t\t\t{MAIN_TARGET} /* Tahajjud */,\n\t\t\t\t{WIDGET_TARGET} /* TahajjudWidget */,"
)

# ══════════════════════════════════════════════════════════════════════════════
# 13. Add widget TargetAttributes
# ══════════════════════════════════════════════════════════════════════════════
src = src.replace(
    f"\t\t\t\t{MAIN_TARGET} = {{\n\t\t\t\t\tLastSwiftMigration = 1250;",
    f"\t\t\t\t{WIDGET_TARGET} = {{\n\t\t\t\t\tCreatedOnToolsVersion = 15.0;\n\t\t\t\t\tDevelopmentTeam = {TEAM};\n\t\t\t\t}};\n\t\t\t\t{MAIN_TARGET} = {{\n\t\t\t\t\tLastSwiftMigration = 1250;"
)

# ══════════════════════════════════════════════════════════════════════════════
# Write back and verify
# ══════════════════════════════════════════════════════════════════════════════
with open(PROJECT, "w") as f:
    f.write(src)

# Quick sanity check
if "TahajjudWidget" in open(PROJECT).read():
    print("✅  TahajjudWidget target added to project.pbxproj successfully!")
    print()
    print("Next steps:")
    print("  1. Open Tahajjud.xcworkspace in Xcode")
    print("  2. Select scheme → Tahajjud (NOT TahajjudWidget)")
    print("  3. Build & run on simulator — widget is now bundled inside the app")
    print()
    print("  To add to home screen:")
    print("  • Long-press home screen → + → search Tahajjud → Add Widget")
else:
    print("❌  Something went wrong — TahajjudWidget not found in output file.")
    sys.exit(1)
