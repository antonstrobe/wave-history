$ErrorActionPreference = 'Stop'
$electron = Join-Path $PSScriptRoot 'node_modules\electron\dist\electron.exe'
$entry = Join-Path $PSScriptRoot 'dist\app.js'
if (-not (Test-Path -LiteralPath $electron) -or -not (Test-Path -LiteralPath $entry)) {
    Add-Type -AssemblyName PresentationFramework
    [System.Windows.MessageBox]::Show('Application files are missing. Run npm install and npm run build in the project folder.', 'Wave History') | Out-Null
    exit 1
}
Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
Start-Process -FilePath $electron -ArgumentList ('"' + $PSScriptRoot + '"') -WorkingDirectory $PSScriptRoot -WindowStyle Normal

# SIG # Begin signature block
# MIIG/QYJKoZIhvcNAQcCoIIG7jCCBuoCAQExDzANBglghkgBZQMEAgEFADB5Bgor
# BgEEAYI3AgEEoGswaTA0BgorBgEEAYI3AgEeMCYCAwEAAAQQH8w7YFlLCE63JNLG
# KX7zUQIBAAIBAAIBAAIBAAIBADAxMA0GCWCGSAFlAwQCAQUABCCOCJ+pGamQ9vkS
# Q2o75ioKgJRH2MDIrv4JzeKvgFZdI6CCA/owggP2MIICXqADAgECAhATSQgO3NG+
# tEVVtOr6aKJOMA0GCSqGSIb3DQEBCwUAMBMxETAPBgNVBAMMCG9rcm9ub29tMB4X
# DTI2MTAxNzIzMDM1NFoXDTMxMTAxNzIzMTM1M1owEzERMA8GA1UEAwwIb2tyb25v
# b20wggGiMA0GCSqGSIb3DQEBAQUAA4IBjwAwggGKAoIBgQDFb19juqxv4ZpMzN+i
# MyAG3YSGmXae5j2pSQ8LTFm23zV2+QFNRKm7Dd8PUsQUhBv8GtMsWSbpsFYQqDGU
# HxEEPavlr6dGwSgVJ1dzFfLtnPzbDiBKaaW9WV34oXy0CH2FXji+PM9NW6qd0gYu
# pHHu4lS6c0WGyb+wL5jsLNdO6pksOhOBnAhjOuiazpjqwD1NY0zkf3Z3rDSRu1x7
# xoi5XZaqwyEy/TVqsD1kn/ejIguNs7ui8kB8OidGohYyKs1PTf4GcodGt7hnu/Nw
# ZeYAXC0QTOPdd8HLp43q+ONWaKOfNLNxsCwPCzPIB3g/befXmRNLfn6GGzZ/PfF4
# 0emN/EBQY3e/QlTcUn7b0C8JUX4Uwtu40SWMy4gv5ctS81+wiUku2Aq54K9HkmB+
# Q8T41aSaWIOzQFRgwMR8zp8Kcsl/FVTCL2NT2CCkZSTy0pmZ7gs9IogPF3UVImOT
# ed5J3rqdC880xWUvD34J4YTaI1dheYu+YqtC8TtmpIL4gy0CAwEAAaNGMEQwDgYD
# VR0PAQH/BAQDAgeAMBMGA1UdJQQMMAoGCCsGAQUFBwMDMB0GA1UdDgQWBBSSke1P
# l4yoftnOxaoTXneqwUc0gTANBgkqhkiG9w0BAQsFAAOCAYEAxDaa3dpb52+t6YF7
# mH/W59XD1Kqc/MOg54rkUCHGL9GdU5ZRE8ntZaRj2WzogtSuQ5kvT0XgIYPVK0hT
# dICEGKSnCUGh76xVLSi9lPUwA99t/vXOFJFamRnaVoN3OrOqSDYVLY/3Dn/setqM
# SUM64I+RkKZEXGgovzsTIcWQkQuJHkGTYj6MjpXM/Afk5xR5rBRcVcGwxrmzh0Tm
# /B3pBe0DWe1e7Pr6Rzr0qFmfUN83Lgs/4G78nCmfI0p19KxnPJHCNOnxRL0O3uYM
# CwdlZLFJgo1erEhvyhQu3gqSS/IfR+6FcHcm63euN4JEAkRSwP/MfGz1fFtlQ7qv
# sQ+I+cCL+Ke9gXHmOzp3EfuxsBra0tmAVD9J3MSBFd2XhGHL+qVk74aqaniBHcbe
# VzFXCOEC6Idvb6rWAkilNFaJhq/Pp0X0feNhh2GPeGo1LNcqt1S8FM2rT2aeXsYp
# HOqbAqJQFLYdxDIbH0WIldy72SP7F203chJfj6I5c6hAX5ouMYICWTCCAlUCAQEw
# JzATMREwDwYDVQQDDAhva3Jvbm9vbQIQE0kIDtzRvrRFVbTq+miiTjANBglghkgB
# ZQMEAgEFAKCBhDAYBgorBgEEAYI3AgEMMQowCKACgAChAoAAMBkGCSqGSIb3DQEJ
# AzEMBgorBgEEAYI3AgEEMBwGCisGAQQBgjcCAQsxDjAMBgorBgEEAYI3AgEVMC8G
# CSqGSIb3DQEJBDEiBCDF+Vq6JxujEZE0U+pmUblx38tjLXOgbXBcgsZV2H36iDAN
# BgkqhkiG9w0BAQEFAASCAYBR8mkaa8AveeFn5R58CpX3sMbXf+MqnKKpbPPC7FU7
# zzZYBdRW9gQWXDraapVKJp/vbClq19fFvRYHUX+60FLCkqNvbFhZ/EQO+HCSAi+x
# pCyPQcUqVV5++w5bpGqd/cV2za0KXnPrjSr0cAdcg2bWpXzQ5nRp2pgOOnLPecbH
# v1zjYGT1a4+nTJ47rUwXd6lwBDGrGbmhZ1EKf7xGxQ0O2Yn9MM6xsO/xZjTaCGW1
# oGeoKiBRpcP0UVzLy9Y1mbPwIlzHX3b1cFwAfmsRv8GzbBRQhAN93ktmSR7JDk4w
# gSv/9w8Y+utMoY+VnHuzm1S6LZAC3ix+nJMMpkgqthsQcf3u/XAPvV86ighZrHT0
# iXRI+bhp3afCl/5qwz7F58ARWKdcig4GZEbDVmJ9JLCwOiiL/ONHW5rRG7AJSTZe
# lYu2KOeNk1l79PDfOhC3aIuWkcY3zOeApS2SHNxahIaLSsYiJ2q5zQfJw99JS66+
# ngrMhK7AJ7h99EBTUB91whg=
# SIG # End signature block
