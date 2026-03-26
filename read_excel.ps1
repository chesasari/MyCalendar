$excelPath = "C:\Users\Nao\Downloads\出社ローテ.xlsx"
$excel = New-Object -ComObject Excel.Application
$workbook = $excel.Workbooks.Open($excelPath)

Write-Host "Sheet Names:"
foreach ($sheet in $workbook.Sheets) {
    Write-Host $sheet.Name
}

# Find sheet with "エントリー(QA)" or "4月"
$targetSheet = $null
foreach ($sheet in $workbook.Sheets) {
    if ($sheet.Name -like "*エントリー(QA)*" -or $sheet.Name -like "*4月*") {
        $targetSheet = $sheet
        break
    }
}

if ($targetSheet) {
    Write-Host "`n--- Content of $($targetSheet.Name) ---"
    $range = $targetSheet.UsedRange
    $rows = $range.Rows.Count
    $cols = $range.Columns.Count

    for ($r = 1; $r -le [Math]::Min($rows, 40); $r++) {
        $line = ""
        for ($c = 1; $c -le $cols; $c++) {
            $val = $targetSheet.Cells.Item($r, $c).Value2
            $line += "$val, "
        }
        Write-Host $line
    }
}

$workbook.Close($false)
$excel.Quit()
[System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null
