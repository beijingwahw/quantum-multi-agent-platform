<#
.SYNOPSIS
    全面测试网站连通性的PowerShell脚本
.DESCRIPTION
    测试29个网站的多维度连通性，包括ping、DNS、端口、HTTP/HTTPS响应等
.NOTES
    File Name      : WebsiteConnectivityTest.ps1
    Author         : AI Assistant
    Prerequisite   : PowerShell 5.1 or later
#>

# 参数配置
param(
    [string]$OutputFile = "WebsiteConnectivityResults.csv",
    [int]$PingTimeout = 5000,
    [int]$HttpTimeout = 10000
)

# 网站列表
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

# 创建结果对象集合
$results = @()

# 创建CSV文件头
Write-Host "开始网站连通性测试..." -ForegroundColor Green
Write-Host "测试网站数量: $($sites.Count)" -ForegroundColor Cyan
Write-Host "输出文件: $OutputFile" -ForegroundColor Cyan

# 测试函数
function Test-WebsiteConnectivity {
    param (
        [string]$url
    )
    
    Write-Host "测试网站: $url" -ForegroundColor Yellow
    
    # 创建结果对象
    $result = [PSCustomObject]@{
        WebsiteURL      = $url
        Status          = "未知"
        PingTime       = $null
        DNSResult      = $null
        Port80         = "未测试"
        Port443        = "未测试"
        Port8080       = "未测试"
        HTTPStatus     = $null
        SSLInfo        = $null
        RedirectURL    = $null
        Timestamp      = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
        CDNDetection   = "未检测"
    }
    
    try {
        # 提取域名
        $uri = [System.Uri]$url
        $hostname = $uri.Host
        $scheme = $uri.Scheme
        
        # 1. DNS解析测试
        Write-Host "  - 测试DNS解析..." -ForegroundColor White
        try {
            $dnsResult = Resolve-DnsName -Name $hostname -ErrorAction Stop
            $result.DNSResult = "解析成功"
            $ipAddress = $dnsResult.IPAddress -join ", "
            Write-Host "  - DNS解析成功: $ipAddress" -ForegroundColor Green
        }
        catch {
            $result.DNSResult = "解析失败"
            $result.Status = "不可达"
            Write-Host "  - DNS解析失败: $($_.Exception.Message)" -ForegroundColor Red
            return $result
        }
        
        # 2. Ping测试
        Write-Host "  - 测试Ping连通性..." -ForegroundColor White
        try {
            $pingResult = Test-Connection -ComputerName $hostname -Count 1 -TimeoutSeconds ($PingTimeout/1000) -ErrorAction Stop
            $result.PingTime = $pingResult.ResponseTime
            $result.Status = "可达"
            Write-Host "  - Ping成功: $($result.PingTime)ms" -ForegroundColor Green
        }
        catch {
            $result.PingTime = $null
            $result.Status = "不可达"
            Write-Host "  - Ping失败: $($_.Exception.Message)" -ForegroundColor Red
        }
        
        # 3. 端口测试
        Write-Host "  - 测试端口连通性..." -ForegroundColor White
        $ports = @("80", "443", "8080")
        foreach ($port in $ports) {
            $portParam = "Port$port"
            try {
                $portTest = Test-NetConnection -ComputerName $hostname -Port $port -WarningAction SilentlyContinue -ErrorAction Stop
                $result.$($portParam) = "开放"
                Write-Host "  - 端口 $port: 开放" -ForegroundColor Green
            }
            catch {
                $result.$($portParam) = "关闭"
                Write-Host "  - 端口 $port: 关闭" -ForegroundColor Red
            }
        }
        
        # 4. HTTP/HTTPS测试
        Write-Host "  - 测试HTTP/HTTPS响应..." -ForegroundColor White
        try {
            $headers = @{
                "User-Agent" = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
                "Accept" = "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8"
            }
            
            $httpParams = @{
                Uri = $url
                Method = "HEAD"
                TimeoutSec = $HttpTimeout/1000
                Headers = $headers
                SkipHttpError = $true
                FollowRedirect = $true
            }
            
            $httpResponse = Invoke-RestMethod @httpParams -ErrorAction Stop
            
            # 获取状态码
            $statusCode = $httpResponse.StatusCode
            $result.HTTPStatus = $statusCode
            
            # 检查SSL信息（如果使用HTTPS）
            if ($scheme -eq "https") {
                try {
                    $sslStream = [System.Net.Security.SslStream]::new($null, $false, { $true })
                    $tcpClient = [System.Net.Sockets.TcpClient]::new()
                    $tcpClient.Connect($hostname, 443)
                    $sslStream.AuthenticateAsClient($hostname)
                    
                    $cert = $sslStream.RemoteCertificate
                    if ($cert) {
                        $result.SSLInfo = "有效"
                        $certInfo = [System.Security.Cryptography.X509Certificates.X509Certificate2]$cert
                        $result.SSLInfo = "$($certInfo.Subject) - $($certInfo.NotBefore.ToString('yyyy-MM-dd')) 到 $($certInfo.NotAfter.ToString('yyyy-MM-dd'))"
                    }
                    else {
                        $result.SSLInfo = "无效证书"
                    }
                    
                    $sslStream.Close()
                    $tcpClient.Close()
                }
                catch {
                    $result.SSLInfo = "SSL连接失败: $($_.Exception.Message)"
                }
            }
            
            # 检查重定向
            if ($httpResponse.ResponseUri -ne $url) {
                $result.RedirectURL = $httpResponse.ResponseUri
                Write-Host "  - 重定向到: $($httpResponse.ResponseUri)" -ForegroundColor Yellow
            }
            
            # CDN检测
            $cdnProviders = @("cloudflare", "akamai", "fastly", "cloudfront", "aliyuncs", "tencent")
            $cdnDetected = $false
            foreach ($cdn in $cdnProviders) {
                if ($ipAddress -like "*$cdn*" -or $hostname -like "*$cdn*") {
                    $result.CDNDetection = $cdn.ToUpper()
                    $cdnDetected = $true
                    break
                }
            }
            if (-not $cdnDetected) {
                $result.CDNDetection = "未检测到CDN"
            }
            
            Write-Host "  - HTTP状态码: $statusCode" -ForegroundColor Green
        }
        catch {
            $result.HTTPStatus = "连接失败"
            Write-Host "  - HTTP测试失败: $($_.Exception.Message)" -ForegroundColor Red
        }
        
        return $result
    }
    catch {
        Write-Host "  - 测试过程中发生错误: $($_.Exception.Message)" -ForegroundColor Red
        return $result
    }
}

# 执行测试
foreach ($site in $sites) {
    $result = Test-WebsiteConnectivity -url $site
    $results += $result
    Write-Host "----------------------------------------" -ForegroundColor Gray
}

# 保存结果到CSV
if ($results.Count -gt 0) {
    $results | Export-Csv -Path $OutputFile -NoTypeInformation -Encoding UTF8
    Write-Host "`n测试完成！结果已保存到: $OutputFile" -ForegroundColor Green
    
    # 显示摘要统计
    $reachable = ($results | Where-Object { $_.Status -eq "可达" }).Count
    $unreachable = ($results | Where-Object { $_.Status -eq "不可达" }).Count
    
    Write-Host "`n测试摘要:" -ForegroundColor Cyan
    Write-Host "总测试网站: $($sites.Count)" -ForegroundColor White
    Write-Host "可达网站: $reachable" -ForegroundColor Green
    Write-Host "不可达网站: $unreachable" -ForegroundColor Red
    Write-Host "可达率: $([math]::Round($reachable/$sites.Count*100, 2))%" -ForegroundColor Cyan
}
else {
    Write-Host "`n没有生成任何测试结果" -ForegroundColor Red
}