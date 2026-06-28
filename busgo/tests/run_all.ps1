<#
  BusGo test commands. Run from busgo/tests/ in PowerShell.
    .\run_all.ps1             # run everything
    .\run_all.ps1 unit        # only unit tests
    .\run_all.ps1 load        # only load-balancing
    .\run_all.ps1 concurrency # only seat-concurrency
    .\run_all.ps1 status      # only current load / replica health

  Override gateway location if needed:
    $env:KONG_URL="http://localhost:18085"; $env:KONG_ADMIN_URL="http://localhost:18089"; .\run_all.ps1
#>
param(
  [ValidateSet("unit", "load", "concurrency", "status", "all")]
  [string]$Cmd = "all"
)

Set-Location $PSScriptRoot

if ($Cmd -eq "all") {
  python run_tests.py unit
  python run_tests.py load
  python run_tests.py concurrency
  python run_tests.py status
}
else {
  python run_tests.py $Cmd
}
