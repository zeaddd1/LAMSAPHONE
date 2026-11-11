<#
  coolify.ps1 - وصول Claude (أو أنت) إلى مشروع واحد فقط في Coolify عبر API

  التوكن لا يُكتب هنا أبداً. يُقرأ من:
    1) متغيرات البيئة: COOLIFY_URL, COOLIFY_TOKEN, COOLIFY_PROJECT_UUID, COOLIFY_READONLY
    2) أو ملف محلي بجانب السكربت: .coolify.env  (مُستثنى من Git)

  أمثلة:
    .\coolify.ps1 test                      # فحص الاتصال واسم المشروع
    .\coolify.ps1 list                      # موارد المشروع فقط (تطبيقات/قواعد بيانات/خدمات)
    .\coolify.ps1 app      <uuid>           # تفاصيل تطبيق
    .\coolify.ps1 envs     <uuid>           # أسماء المتغيرات (القيم مخفية)
    .\coolify.ps1 logs     <uuid> [lines]   # آخر سطور السجل
    .\coolify.ps1 deployments               # عمليات النشر الجارية
    .\coolify.ps1 deploy   <uuid>           # نشر (كتابة)
    .\coolify.ps1 restart  <uuid>           # إعادة تشغيل (كتابة)
    .\coolify.ps1 stop|start <uuid>         # إيقاف/تشغيل (كتابة)
    .\coolify.ps1 setenv   <uuid> KEY VALUE # إضافة/تعديل متغير (كتابة)
    .\coolify.ps1 create-image <name> <image:tag> <port> <https://domain> [healthPath] [memory]
                                            # إنشاء تطبيق من صورة Docker داخل المشروع المسموح فقط (كتابة)

  الحماية:
    - أي uuid ليس داخل COOLIFY_PROJECT_UUID يُرفض قبل إرسال الطلب.
    - COOLIFY_READONLY=true يمنع كل أوامر الكتابة.
    - التوكن لا يُطبع أبداً، وقيم المتغيرات لا تُعرض.
#>
param(
  [Parameter(Position = 0)][string]$Command = "help",
  [Parameter(Position = 1)][string]$Uuid,
  [Parameter(Position = 2)][string]$Arg1,
  [Parameter(Position = 3)][string]$Arg2,
  [Parameter(Position = 4)][string]$Arg3,
  [Parameter(Position = 5)][string]$Arg4,
  [Parameter(Position = 6)][string]$Arg5
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
# Windows PowerShell 5.1 قد يستخدم TLS قديماً افتراضياً؛ نفرض TLS 1.2
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

# ---------- 1) قراءة الإعدادات ----------
function Read-EnvFile($path) {
  $map = @{}
  if (Test-Path $path) {
    foreach ($line in Get-Content -Path $path -Encoding UTF8) {
      $t = $line.Trim()
      if ($t -eq "" -or $t.StartsWith("#")) { continue }
      $i = $t.IndexOf("=")
      if ($i -lt 1) { continue }
      $k = $t.Substring(0, $i).Trim()
      $v = $t.Substring($i + 1).Trim().Trim('"').Trim("'")
      $map[$k] = $v
    }
  }
  return $map
}

$fileCfg = Read-EnvFile (Join-Path $PSScriptRoot ".coolify.env")
function Get-Cfg($name) {
  $v = [Environment]::GetEnvironmentVariable($name)
  if ([string]::IsNullOrWhiteSpace($v)) { $v = $fileCfg[$name] }
  return $v
}

$BaseUrl     = Get-Cfg "COOLIFY_URL"
$Token       = Get-Cfg "COOLIFY_TOKEN"
$ProjectUuid = Get-Cfg "COOLIFY_PROJECT_UUID"
$ReadOnly    = ((Get-Cfg "COOLIFY_READONLY") -eq "true")

if ($Command -eq "help") { Get-Help $PSCommandPath -Full | Out-String | Write-Host; exit 0 }

if (-not $BaseUrl -or -not $Token -or -not $ProjectUuid) {
  Write-Host "ناقص: COOLIFY_URL أو COOLIFY_TOKEN أو COOLIFY_PROJECT_UUID. انسخ .coolify.env.example إلى .coolify.env واملأه." -ForegroundColor Red
  exit 2
}
$Api = ($BaseUrl.TrimEnd("/")) + "/api/v1"
$Headers = @{ Authorization = "Bearer $Token"; Accept = "application/json" }

# ---------- 2) استدعاء الـ API ----------
function Invoke-Coolify([string]$Method, [string]$Path, $Body = $null) {
  $params = @{ Method = $Method; Uri = "$Api$Path"; Headers = $Headers }
  if ($null -ne $Body) {
    $params.Body = [System.Text.Encoding]::UTF8.GetBytes(($Body | ConvertTo-Json -Depth 10))
    $params.ContentType = "application/json; charset=utf-8"
  }
  try { return Invoke-RestMethod @params }
  catch {
    $code = $null
    if ($_.Exception.Response) { $code = [int]$_.Exception.Response.StatusCode }
    Write-Host "فشل $Method $Path (HTTP $code): $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Message -match "trust relationship|SSL|TLS") {
      Write-Host "الشهادة غير موثوقة: استخدم رابط Coolify بدومين عليه شهادة صالحة (مثل https://coolify.yemenbay.com) وليس https://IP:8000." -ForegroundColor Yellow
    }
    exit 1
  }
}

# ---------- 3) حصر الموارد في المشروع المحدد ----------
function Get-ProjectResources {
  $project = Invoke-Coolify GET "/projects/$ProjectUuid"
  $items = @()
  foreach ($env in @($project.environments)) {
    $e = Invoke-Coolify GET "/projects/$ProjectUuid/$([uri]::EscapeDataString($env.name))"
    foreach ($prop in $e.PSObject.Properties) {
      # كل خاصية مصفوفة (applications, postgresqls, redis, services, ...) تحوي موارد
      if ($prop.Value -is [System.Array]) {
        foreach ($r in $prop.Value) {
          if ($r.uuid) {
            $items += [pscustomobject]@{
              type = $prop.Name; name = $r.name; uuid = $r.uuid
              status = $r.status; environment = $env.name
            }
          }
        }
      }
    }
  }
  return @{ project = $project; items = $items }
}

function Assert-InProject([string]$id) {
  if (-not $id) { Write-Host "مطلوب uuid." -ForegroundColor Red; exit 2 }
  $res = Get-ProjectResources
  $hit = $res.items | Where-Object { $_.uuid -eq $id }
  if (-not $hit) {
    Write-Host "مرفوض: المورد $id ليس ضمن المشروع المسموح." -ForegroundColor Red
    exit 3
  }
  return $hit
}

function Assert-Writable {
  if ($ReadOnly) { Write-Host "مرفوض: وضع القراءة فقط مفعّل (COOLIFY_READONLY=true)." -ForegroundColor Yellow; exit 4 }
}

# ---------- 4) الأوامر ----------
switch ($Command) {
  "test" {
    $ver = Invoke-Coolify GET "/version"
    $res = Get-ProjectResources
    Write-Host "متصل. إصدار Coolify: $ver"
    Write-Host "المشروع: $($res.project.name)  |  الموارد: $(@($res.items).Count)  |  قراءة فقط: $ReadOnly"
  }
  "list" {
    (Get-ProjectResources).items | Sort-Object type, name | Format-Table type, name, status, uuid, environment -AutoSize
  }
  "app" {
    $null = Assert-InProject $Uuid
    Invoke-Coolify GET "/applications/$Uuid" |
      Select-Object name, uuid, fqdn, status, docker_registry_image_name, docker_registry_image_tag,
                    ports_exposes, health_check_path, limits_memory, build_pack |
      Format-List
  }
  "envs" {
    $null = Assert-InProject $Uuid
    Invoke-Coolify GET "/applications/$Uuid/envs" |
      ForEach-Object { $_ } |
      Select-Object key, is_build_time, is_preview, @{ n = "value"; e = { "********" } } |
      Format-Table -AutoSize
  }
  "logs" {
    $null = Assert-InProject $Uuid
    $lines = 100; if ($Arg1) { $lines = [int]$Arg1 }
    (Invoke-Coolify GET "/applications/$Uuid/logs?lines=$lines").logs
  }
  "deployments" {
    $ids = (Get-ProjectResources).items.uuid
    Invoke-Coolify GET "/deployments" | ForEach-Object { $_ } |
      Where-Object { $ids -contains $_.application_id -or $ids -contains $_.application_uuid } |
      Format-Table -AutoSize
  }
  "deploy" {
    Assert-Writable; $null = Assert-InProject $Uuid
    Invoke-Coolify GET "/deploy?uuid=$Uuid&force=false" | ConvertTo-Json -Depth 5
  }
  { $_ -in @("restart", "stop", "start") } {
    Assert-Writable; $hit = Assert-InProject $Uuid
    $kind = "applications"
    if ($hit.type -eq "services") { $kind = "services" }
    elseif ($hit.type -ne "applications") { $kind = "databases" }
    Invoke-Coolify GET "/$kind/$Uuid/$Command" | ConvertTo-Json -Depth 5
  }
  "setenv" {
    Assert-Writable; $null = Assert-InProject $Uuid
    if (-not $Arg1) { Write-Host "الاستخدام: setenv <uuid> KEY VALUE" -ForegroundColor Red; exit 2 }
    $existing = Invoke-Coolify GET "/applications/$Uuid/envs" | ForEach-Object { $_ } | Where-Object { $_.key -eq $Arg1 }
    $body = @{ key = $Arg1; value = $Arg2 }
    if ($existing) { $null = Invoke-Coolify PATCH "/applications/$Uuid/envs" $body; Write-Host "عُدّل $Arg1" }
    else           { $null = Invoke-Coolify POST  "/applications/$Uuid/envs" $body; Write-Host "أُضيف $Arg1" }
    Write-Host "ملاحظة: يلزم restart أو deploy ليأخذ التطبيق القيمة الجديدة."
  }
  "create-image" {
    Assert-Writable
    # الوسائط: name image:tag port domain [health] [memory]
    $name = $Uuid; $image = $Arg1; $port = $Arg2
    $domain = $Arg3; $health = $Arg4; $mem = $Arg5
    if (-not $name -or -not $image -or -not $port -or -not $domain) {
      Write-Host "الاستخدام: create-image <name> <image:tag> <port> <https://domain> [healthPath] [memory]" -ForegroundColor Red; exit 2
    }
    $parts = $image.Split(":"); $img = $parts[0]; $tag = "latest"; if ($parts.Count -gt 1) { $tag = $parts[1] }
    $project = Invoke-Coolify GET "/projects/$ProjectUuid"
    $env = @($project.environments)[0]
    $servers = @(Invoke-Coolify GET "/servers")
    $body = @{
      project_uuid = $ProjectUuid; environment_name = $env.name; server_uuid = $servers[0].uuid
      name = $name; docker_registry_image_name = $img; docker_registry_image_tag = $tag
      ports_exposes = "$port"; domains = $domain; instant_deploy = $false
    }
    $r = Invoke-Coolify POST "/applications/dockerimage" $body
    $patch = @{}
    if ($health) { $patch.health_check_enabled = $true; $patch.health_check_path = $health }
    if ($mem) { $patch.limits_memory = $mem }
    if ($patch.Count) { $null = Invoke-Coolify PATCH "/applications/$($r.uuid)" $patch }
    Write-Host "أُنشئ التطبيق $name ($($r.uuid)) داخل $($project.name)/$($env.name). لم يُنشر بعد."
  }
  default { Write-Host "أمر غير معروف: $Command. شغّل: .\coolify.ps1 help" -ForegroundColor Red; exit 2 }
}
