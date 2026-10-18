param([string]$SourceRef='HEAD')
$ErrorActionPreference='Stop'
$repoRoot=Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$previewPath='builds/story-expansion'
function Run-Git {
  param([Parameter(ValueFromRemainingArguments=$true)][string[]]$Arguments)
  $output=& git -C $repoRoot @Arguments
  if($LASTEXITCODE -ne 0){throw "git $($Arguments[0]) failed ($LASTEXITCODE)"}
  return $output
}
$sourceCommit=Run-Git rev-parse "$SourceRef^{commit}"
Run-Git fetch origin main
$remotePages=Run-Git ls-remote --heads origin gh-pages
if($remotePages){Run-Git fetch origin gh-pages;$parent=Run-Git rev-parse origin/gh-pages}
else {$parent=Run-Git rev-parse origin/main}
# An isolated index assembles a publishing tree without switching or modifying the checkout.
$previousIndex=$env:GIT_INDEX_FILE
$previewIndex=Join-Path ([IO.Path]::GetTempPath()) ("light-pathfinder-pages-"+[guid]::NewGuid().ToString('N'))
try {
  $env:GIT_INDEX_FILE=$previewIndex
  Run-Git read-tree $parent
  $previousFiles=Run-Git ls-files -- "$previewPath/"
  if($previousFiles){$previousFiles | & git -C $repoRoot update-index --force-remove --stdin;if($LASTEXITCODE -ne 0){throw 'Could not replace preview files'}}
  Run-Git read-tree "--prefix=$previewPath/" "$($sourceCommit):LightPathfinderJS"
  $info=@{commit=$sourceCommit;branch='feature/story-expansion';publishedUtc=[DateTime]::UtcNow.ToString('o')} | ConvertTo-Json -Compress
  $infoBlob=$info | & git -C $repoRoot hash-object -w --stdin
  if($LASTEXITCODE -ne 0){throw 'Could not write build metadata'}
  Run-Git update-index --add --cacheinfo "100644,$infoBlob,$previewPath/build-info.json"
  $tree=Run-Git write-tree
  $publishCommit=Run-Git commit-tree $tree -p $parent -m "Publish story expansion preview ($($sourceCommit.Substring(0,7)))"
  Run-Git push origin "$($publishCommit):refs/heads/gh-pages"
  Write-Output "Published $sourceCommit to https://mytriv.github.io/light_pathfinder/$previewPath/"
} finally {
  $env:GIT_INDEX_FILE=$previousIndex
  if(Test-Path -LiteralPath $previewIndex){Remove-Item -LiteralPath $previewIndex}
}
