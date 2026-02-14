param (
    [string]$SourceDir = ".\assets\screenshots",
    [string]$OutputDir = ".\assets\screenshots\resized"
)

Add-Type -AssemblyName System.Drawing

if (-not (Test-Path $SourceDir)) {
    Write-Host "Creating source directory: $SourceDir"
    New-Item -ItemType Directory -Path $SourceDir | Out-Null
    Write-Warning "Please copy your PNG screenshots into: $SourceDir and run this script again."
    exit
}

if (-not (Test-Path $OutputDir)) {
    New-Item -ItemType Directory -Path $OutputDir | Out-Null
}

$targets = @(
    @{ W = 1242; H = 2688; Name = "6.5inch_Portrait" },
    @{ W = 2688; H = 1242; Name = "6.5inch_Landscape" },
    @{ W = 1284; H = 2778; Name = "6.7inch_Portrait" }
)

$files = Get-ChildItem -Path $SourceDir -Filter *.png

if ($files.Count -eq 0) {
    Write-Warning "No .png files found in $SourceDir"
    exit
}

foreach ($file in $files) {
    Write-Host "Processing $($file.Name)..."
    try {
        $img = [System.Drawing.Image]::FromFile($file.FullName)
        
        foreach ($t in $targets) {
            $newWidth = $t.W
            $newHeight = $t.H
            
            $rect = New-Object System.Drawing.Rectangle 0, 0, $newWidth, $newHeight
            # Create 24-bit RGB bitmap (removes alpha channel)
            $pixelFormat = [System.Drawing.Imaging.PixelFormat]::Format24bppRgb
            $dest = New-Object System.Drawing.Bitmap -ArgumentList $newWidth, $newHeight, $pixelFormat
            $dest.SetResolution($img.HorizontalResolution, $img.VerticalResolution)
            
            $graph = [System.Drawing.Graphics]::FromImage($dest)
            $graph.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
            $graph.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
            $graph.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
            $graph.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

            # Draw white background first just in case
            $graph.Clear([System.Drawing.Color]::White)
            
            # Draw image resized
            $graph.DrawImage($img, $rect)
            
            $outName = "$($file.BaseName)_$($t.Name).png"
            $outPath = Join-Path $OutputDir $outName
            
            $dest.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
            Write-Host "  -> Saved $outName"
            
            $graph.Dispose()
            $dest.Dispose()
        }
        $img.Dispose()
    }
    catch {
        Write-Error "Failed to process $($file.Name): $_"
    }
}

Write-Host "Done! Resized images are in $OutputDir"
