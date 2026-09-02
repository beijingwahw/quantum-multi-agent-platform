# Website Connectivity Test Script
# PowerShell script for website connectivity testing

# Define the list of websites to test
$sites = @(
    "https://douyin18.vip",
    "https://douyin18.net",
    "https://douyin18.one",
    "https://dyxy6.tv",
    "https://f7h79sz.8o7hxfn.com",
    "https://k8k54g3bj.bmtbiv2.com",
    "https://f9h7ff4j3.fpukhq.com",
    "https://3fh0j3f.g4n8m2x.com",
    "https://2bc4z4f5.2txs4c.com",
    "https://4h5hplee.w4xt9yo.com",
    "https://ysbq3a3q.w4xt9yo.com",
    "https://zx0g1zbb.2thb9d8.com",
    "https://tqq3krjt.2txs4c.com",
    "https://zx0g1zbb.2thb9d8.com",
    "https://np24g830.5f0r5s.com",
    "https://kg0cc1mb.bsgbq0ls.com",
    "https://5r6nw9bn.w4xt9yo.com",
    "https://jur1lunx.qp1a4yh3.com",
    "https://mmbav6dh.owgud0ge.com",
    "https://3whdxwk4.a6cfwbq.com",
    "https://4h5hplee.w4xt9yo.com",
    "https://lv28ymf1.37wjm8.com",
    "https://kg0cc1mb.bsgbq0ls.com",
    "https://m37140ke.u94ugb.com",
    "https://jur1lunx.qp1a4yh3.com",
    "https://4cvhy5pf.bdz38qy0.com",
    "https://4h5hplee.w4xt9yo.com",
    "https://f7h79sz.8o7hxfn.com",
    "https://dy23.me"
)

# Create results directory
$resultDir = "Results"
if (-not (Test-Path $resultDir)) {
    New-Item -ItemType Directory -Path $resultDir | Out-Null
}

# Set output CSV file
$outputFile = Join-Path $resultDir "website_connectivity_results_$(Get-Date -Format 'yyyyMMdd_HHmmss').csv"
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"

# CSV header
$csvHeaders = "WebsiteURL,Status,PingTime,DNSResult,Port80,Port443,Port8080,HTTPStatus,SSLInfo,RedirectURL,Timestamp,CDNDetection"
$csvHeaders | Out-File -FilePath $outputFile -Encoding UTF8

Write-Host "Starting website connectivity test..." -ForegroundColor Green
Write-Host "Total sites to test: $($sites.Count)" -ForegroundColor Yellow
Write-Host "Results will be saved to: $outputFile" -ForegroundColor Cyan

# Test each website
foreach ($site in $sites) {
    Write-Host "`nTesting: $site" -ForegroundColor White
    
    # Extract domain for testing
    $domain = $site -replace '^https?://', '' -replace '/.*', ''
    
    # Initialize result variables
    $status = "Unreachable"
    $pingTime = ""
    $dnsResult = ""
    $port80 = "Closed"
    $port443 = "Closed"
    $port8080 = "Closed"
    $httpStatus = ""
    $sslInfo = ""
    $redirectUrl = ""
    $cdnDetection = "No CDN Detected"
    
    try {
        # 1. DNS resolution test
        Write-Host "  - DNS resolution test..." -ForegroundColor DarkGray
        $dnsTest = Resolve-DnsName -Name $domain -ErrorAction SilentlyContinue -Type A
        if ($dnsTest) {
            $dnsResult = $dnsTest.IPAddress -join ", "
            $status = "Reachable"
        }
        
        # 2. Ping test
        Write-Host "  - Ping connectivity test..." -ForegroundColor DarkGray
        $pingTest = Test-Connection -ComputerName $domain -Count 2 -ErrorAction SilentlyContinue
        if ($pingTest) {
            $pingTime = "$($pingTest.ResponseTime.Average) ms"
        }
        
        # 3. Port connectivity test
        Write-Host "  - Port connectivity test..." -ForegroundColor DarkGray
        $portTest80 = Test-NetConnection -ComputerName $domain -Port 80 -WarningAction SilentlyContinue
        if ($portTest80.TcpTestSucceeded) {
            $port80 = "Open"
        }
        
        $portTest443 = Test-NetConnection -ComputerName $domain -Port 443 -WarningAction SilentlyContinue
        if ($portTest443.TcpTestSucceeded) {
            $port443 = "Open"
        }
        
        $portTest8080 = Test-NetConnection -ComputerName $domain -Port 8080 -WarningAction SilentlyContinue
        if ($portTest8080.TcpTestSucceeded) {
            $port8080 = "Open"
        }
        
        # 4. HTTP/HTTPS response test
        if ($port443 -eq "Open") {
            Write-Host "  - HTTPS response test..." -ForegroundColor DarkGray
            try {
                $httpsResponse = Invoke-WebRequest -Uri $site -UseBasicParsing -TimeoutSec 10 -MaximumRedirection 5 -ErrorAction Stop
                $httpStatus = $httpsResponse.StatusCode.ToString()
                $sslInfo = $httpsResponse.Headers['Server']
                
                # Check for redirects
                if ($httpsResponse.BaseResponse.ResponseUri -ne $site) {
                    $redirectUrl = $httpsResponse.BaseResponse.ResponseUri.ToString()
                }
                
                # Simple CDN detection
                if ($sslInfo -match "cloudflare|akamai|cloudfront|fastly|cloudflare-nginx") {
                    $cdnDetection = "CDN Detected: $matches[0]"
                }
            }
            catch {
                if ($_.Exception.Message -match "301|302|303|307|308") {
                    $httpStatus = "Redirect"
                }
                else {
                    $httpStatus = "Connection Failed"
                }
            }
        }
        elseif ($port80 -eq "Open") {
            Write-Host "  - HTTP response test..." -ForegroundColor DarkGray
            try {
                $httpResponse = Invoke-WebRequest -Uri $site -UseBasicParsing -TimeoutSec 10 -MaximumRedirection 5 -ErrorAction Stop
                $httpStatus = $httpResponse.StatusCode.ToString()
                
                # Check for redirects
                if ($httpResponse.BaseResponse.ResponseUri -ne $site) {
                    $redirectUrl = $httpResponse.BaseResponse.ResponseUri.ToString()
                }
            }
            catch {
                if ($_.Exception.Message -match "301|302|303|307|308") {
                    $httpStatus = "Redirect"
                }
                else {
                    $httpStatus = "Connection Failed"
                }
            }
        }
    }
    catch {
        $status = "Unreachable"
        Write-Host "  - Test failed: $($_.Exception.Message)" -ForegroundColor Red
    }
    
    # Create CSV row
    $csvRow = "$site,$status,$pingTime,$dnsResult,$port80,$port443,$port8080,$httpStatus,$sslInfo,$redirectUrl,$timestamp,$cdnDetection"
    
    # Write result to CSV
    $csvRow | Out-File -FilePath $outputFile -Encoding UTF8 -Append
    
    # Display result summary
    Write-Host "  - Test completed - Status: $status" -ForegroundColor $(if ($status -eq "Reachable") { "Green" } else { "Red" })
    Write-Host "  - Ping: $pingTime" -ForegroundColor Gray
    Write-Host "  - DNS: $dnsResult" -ForegroundColor Gray
    Write-Host "  - Ports: 80=$port80, 443=$port443, 8080=$port8080" -ForegroundColor Gray
    Write-Host "  - HTTP: $httpStatus" -ForegroundColor Gray
    Write-Host "  - CDN: $cdnDetection" -ForegroundColor Gray
}

Write-Host "`nTest completed! Results saved to: $outputFile" -ForegroundColor Green