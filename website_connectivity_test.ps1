# 网站连通性测试脚本
# PowerShell script for website connectivity testing

# 定义要测试的网站列表
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

# 创建结果目录
$resultDir = "Results"
if (-not (Test-Path $resultDir)) {
    New-Item -ItemType Directory -Path $resultDir | Out-Null
}

# 设置输出CSV文件
$outputFile = Join-Path $resultDir "website_connectivity_results_$(Get-Date -Format 'yyyyMMdd_HHmmss').csv"
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"

# CSV头信息
$csvHeaders = "WebsiteURL,Status,PingTime,DNSResult,Port80,Port443,Port8080,HTTPStatus,SSLInfo,RedirectURL,Timestamp,CDNDetection"
$csvHeaders | Out-File -FilePath $outputFile -Encoding UTF8

Write-Host "开始网站连通性测试..." -ForegroundColor Green
Write-Host "共需要测试 $($sites.Count) 个网站" -ForegroundColor Yellow
Write-Host "结果将保存到: $outputFile" -ForegroundColor Cyan

# 测试每个网站
foreach ($site in $sites) {
    Write-Host "`n正在测试: $site" -ForegroundColor White
    
    # 提取域名用于测试
    $domain = $site -replace '^https?://', '' -replace '/.*', ''
    
    # 初始化结果变量
    $status = "不可达"
    $pingTime = ""
    $dnsResult = ""
    $port80 = "关闭"
    $port443 = "关闭"
    $port8080 = "关闭"
    $httpStatus = ""
    $sslInfo = ""
    $redirectUrl = ""
    $cdnDetection = "未检测到"
    
    try {
        # 1. DNS解析测试
        Write-Host "  - DNS解析测试..." -ForegroundColor DarkGray
        $dnsTest = Resolve-DnsName -Name $domain -ErrorAction SilentlyContinue -Type A
        if ($dnsTest) {
            $dnsResult = $dnsTest.IPAddress -join ", "
            $status = "可达"
        }
        
        # 2. Ping测试
        Write-Host "  - Ping连通性测试..." -ForegroundColor DarkGray
        $pingTest = Test-Connection -ComputerName $domain -Count 2 -ErrorAction SilentlyContinue
        if ($pingTest) {
            $pingTime = "$($pingTest.ResponseTime.Average) ms"
        }
        
        # 3. 端口连通性测试
        Write-Host "  - 端口连通性测试..." -ForegroundColor DarkGray
        $portTest80 = Test-NetConnection -ComputerName $domain -Port 80 -WarningAction SilentlyContinue
        if ($portTest80.TcpTestSucceeded) {
            $port80 = "开放"
        }
        
        $portTest443 = Test-NetConnection -ComputerName $domain -Port 443 -WarningAction SilentlyContinue
        if ($portTest443.TcpTestSucceeded) {
            $port443 = "开放"
        }
        
        $portTest8080 = Test-NetConnection -ComputerName $domain -Port 8080 -WarningAction SilentlyContinue
        if ($portTest8080.TcpTestSucceeded) {
            $port8080 = "开放"
        }
        
        # 4. HTTP/HTTPS响应测试
        if ($port443 -eq "开放") {
            Write-Host "  - HTTPS响应测试..." -ForegroundColor DarkGray
            try {
                $httpsResponse = Invoke-WebRequest -Uri $site -UseBasicParsing -TimeoutSec 10 -MaximumRedirection 5 -ErrorAction Stop
                $httpStatus = $httpsResponse.StatusCode.ToString()
                $sslInfo = $httpsResponse.Headers['Server']
                
                # 检查重定向
                if ($httpsResponse.BaseResponse.ResponseUri -ne $site) {
                    $redirectUrl = $httpsResponse.BaseResponse.ResponseUri.ToString()
                }
                
                # 简单的CDN检测
                if ($sslInfo -match "cloudflare|akamai|cloudfront|fastly|cloudflare-nginx") {
                    $cdnDetection = "检测到CDN: $matches[0]"
                }
            }
            catch {
                if ($_.Exception.Message -match "301|302|303|307|308") {
                    $httpStatus = "重定向"
                }
                else {
                    $httpStatus = "连接失败"
                }
            }
        }
        elseif ($port80 -eq "开放") {
            Write-Host "  - HTTP响应测试..." -ForegroundColor DarkGray
            try {
                $httpResponse = Invoke-WebRequest -Uri $site -UseBasicParsing -TimeoutSec 10 -MaximumRedirection 5 -ErrorAction Stop
                $httpStatus = $httpResponse.StatusCode.ToString()
                
                # 检查重定向
                if ($httpResponse.BaseResponse.ResponseUri -ne $site) {
                    $redirectUrl = $httpResponse.BaseResponse.ResponseUri.ToString()
                }
            }
            catch {
                if ($_.Exception.Message -match "301|302|303|307|308") {
                    $httpStatus = "重定向"
                }
                else {
                    $httpStatus = "连接失败"
                }
            }
        }
    }
    catch {
        $status = "不可达"
        Write-Host "  - 测试失败: $($_.Exception.Message)" -ForegroundColor Red
    }
    
    # 创建CSV行
    $csvRow = "$site,$status,$pingTime,$dnsResult,$port80,$port443,$port8080,$httpStatus,$sslInfo,$redirectUrl,$timestamp,$cdnDetection"
    
    # 写入结果到CSV
    $csvRow | Out-File -FilePath $outputFile -Encoding UTF8 -Append
    
    # 显示结果摘要
    Write-Host "  - 测试完成 - 状态: $status" -ForegroundColor $(if ($status -eq "可达") { "Green" } else { "Red" })
    Write-Host "  - Ping: $pingTime" -ForegroundColor Gray
    Write-Host "  - DNS: $dnsResult" -ForegroundColor Gray
    Write-Host "  - 端口: 80=$port80, 443=$port443, 8080=$port8080" -ForegroundColor Gray
    Write-Host "  - HTTP: $httpStatus" -ForegroundColor Gray
    Write-Host "  - CDN: $cdnDetection" -ForegroundColor Gray
}

Write-Host "`n测试完成! 结果已保存到: $outputFile" -ForegroundColor Green