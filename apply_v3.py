#!/usr/bin/env python3
"""Safely apply DigitalDeviceHub v3 assets to a checked-out site repo."""
from pathlib import Path
import argparse, shutil, datetime, re, sys

parser=argparse.ArgumentParser()
parser.add_argument('site_root',help='Path to the existing website repository directory')
parser.add_argument('--dry-run',action='store_true',help='Print planned operations without writing')
a=parser.parse_args()
site=Path(a.site_root).resolve()
assets=Path(__file__).resolve().parent
if not (site/'marketplace.html').is_file() or not (site/'premium-ui.css').is_file():
 sys.exit('ERROR: Provide the existing DigitalDeviceHub site repository root.')
files=['index.html','trust.html','home-v3.css','home-v3.js','theme-v3.css','fonts/schibsted-grotesk-latin-wght-normal.woff2']
css='<link rel="stylesheet" href="/theme-v3.css?v=20261011">'
changes={}
for rel in files: changes[rel]=(assets/rel).read_bytes()
for p in site.glob('*.html'):
 if p.name in ('index.html','trust.html'):continue
 s=p.read_text('utf-8')
 if '/premium-ui.css' not in s:continue
 original=s
 if 'theme-v3.css' not in s:
  s=re.sub(r'(<link\b[^>]*href=["\']/premium-ui\.css[^>]*>)',lambda m:m.group(1)+css,s,count=1)
 s=re.sub(r'<script\s+src=["\']/apple-motion\.js\?v=20261005-studio1["\']\s+defer></script>','',s)
 if s!=original:changes[p.name]=s.encode('utf-8')
sw=site/'service-worker.js'
if not sw.is_file():sys.exit('ERROR: service-worker.js missing; refusing incomplete deployment.')
s=sw.read_text('utf-8')
match=re.search(r"const CACHE=\x27ddh-v(\d+)\x27",s)
if not match:sys.exit('ERROR: Unknown service worker cache version format.')
new_version=max(int(match.group(1))+1,68)
s=s[:match.start(1)]+str(new_version)+s[match.end(1):]
for asset in ['/home-v3.css','/home-v3.js','/theme-v3.css','/fonts/schibsted-grotesk-latin-wght-normal.woff2']:
 if "'"+asset+"'" not in s:
  s=s.replace("const ASSETS=[", "const ASSETS=['"+asset+"',",1)
changes['service-worker.js']=s.encode('utf-8')
backup=site/('.ddh-v3-backup-'+datetime.datetime.now().strftime('%Y%m%d-%H%M%S'))
print('Target:',site,'\nBackup:',backup)
for rel in changes:print(('UPDATE' if (site/rel).exists() else 'CREATE'),rel)
if a.dry_run:sys.exit(0)
backup.mkdir()
for rel,data in changes.items():
 dest=site/rel
 if dest.exists():
  b=backup/rel;b.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(dest,b)
 dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(data)
print('Applied',len(changes),'files. Backups stored at',backup)
