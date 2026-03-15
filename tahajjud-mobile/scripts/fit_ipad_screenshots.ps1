param (
    [string]$SourcePath,
    [string]$OutputPath,
    [int]$CanvasWidth = 2048,
    [int]$CanvasHeight = 2732,
    [string]$BgColorHex = "#05070A"
)

Add-Type -AssemblyName System.Drawing

try {
    if (-not (Test-Path $SourcePath)) {
        throw "Source file not found: $SourcePath"
    }

    $img = [System.Drawing.Image]::FromFile($SourcePath)
    
    # Calculate scale to fit height
    $scale = $CanvasHeight / $img.Height
    $newWidth = [int]($img.Width * $scale)
    $newHeight = $CanvasHeight

    # If width exceeds canvas, scale to width instead
    if ($newWidth -gt $CanvasWidth) {
        $scale = $CanvasWidth / $img.Width
        $newHeight = [int]($img.Height * $scale)
        $newWidth = $CanvasWidth
    }

    # Center position
    $posX = [int](($CanvasWidth - $newWidth) / 2)
    $posY = [int](($CanvasHeight - $newHeight) / 2)

    $format = [System.Drawing.Imaging.PixelFormat]::Format24bppRgb
    $dest = New-Object System.Drawing.Bitmap($CanvasWidth, $CanvasHeight, $format)
    # Use standard 72 DPI or match source
    $dest.SetResolution(72, 72)
    
    $graph = [System.Drawing.Graphics]::FromImage($dest)
    $graph.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $graph.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graph.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $graph.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

    # Background color
    $bgColor = [System.Drawing.ColorTranslator]::FromHtml($BgColorHex)
    $graph.Clear($bgColor)
    
    # Draw image centered
    $rect = New-Object System.Drawing.Rectangle $posX, $posY, $newWidth, $newHeight
    $graph.DrawImage($img, $rect)
    
    $dest.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    Write-Host "Saved: $OutputPath"

    $graph.Dispose()
    $dest.Dispose()
    $img.Dispose()
}
catch {
    Write-Error "Error: $_"
    exit 1
}
