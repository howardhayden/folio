"""New isolated fail-closed cross-process240-second lease; no lease reset method."""
from datetime import datetime,timezone
import math,re,subprocess,sys,time,hashlib,stat
from pathlib import Path

FIELDS={'utc','monotonic_ns','boot_session_uuid','clock_implementation'}

# Exact measured bundled runtime; an incompatible process never creates a snapshot.
PYTHON_RESOLVED='/Users/howie/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3.12'
PYTHON_VERSION=(3,12,14)
PYTHON_BYTES=18058560
PYTHON_SHA256='8506f337a83611246ffcff62d6e96c6d2269e5db48508ca3ac2553d56c962aee'
if not __debug__:raise RuntimeError('Clock guard requires assertions enabled')

def runtime_guard():
 assert sys.implementation.name=='cpython' and sys.version_info>=(3,10),'Unsupported cross-process monotonic runtime'
 assert tuple(sys.version_info[:3])==PYTHON_VERSION,'Unreviewed Python version'
 executable=Path(sys.executable).resolve(strict=True)
 assert str(executable)==PYTHON_RESOLVED and executable.is_file(),'Unreviewed Python executable'
 assert stat.S_IMODE(executable.stat().st_mode)==0o755,'Unreviewed Python executable mode'
 raw=executable.read_bytes()
 assert len(raw)==PYTHON_BYTES and hashlib.sha256(raw).hexdigest()==PYTHON_SHA256,'Unreviewed Python executable bytes'
 return {'implementation':sys.implementation.name,'version':list(sys.version_info[:3]),'resolved_executable':str(executable),'bytes':len(raw),'sha256':PYTHON_SHA256}

def snapshot():
 runtime_guard()
 assert sys.platform=='darwin','Unknown boot/clock context'
 info=time.get_clock_info('monotonic')
 assert info.monotonic is True and info.adjustable is False and info.implementation=='mach_absolute_time()','Unknown monotonic clock context'
 boot=subprocess.check_output(['/usr/sbin/sysctl','-n','kern.bootsessionuuid'],text=True,timeout=5).strip().lower()
 assert re.fullmatch('[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}',boot),'Unknown boot session'
 return {'utc':datetime.now(timezone.utc).isoformat(),'monotonic_ns':time.monotonic_ns(),'boot_session_uuid':boot,'clock_implementation':info.implementation}

def remaining(start,current):
 for v in [start,current]:
  assert type(v) is dict and set(v)==FIELDS
  assert type(v['monotonic_ns']) is int and v['monotonic_ns']>=0
  assert type(v['boot_session_uuid']) is str and re.fullmatch('[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}',v['boot_session_uuid'])
  assert v['clock_implementation']=='mach_absolute_time()'
  assert type(v['utc']) is str
  dt=datetime.fromisoformat(v['utc']);assert dt.tzinfo is not None and dt.utcoffset().total_seconds()==0
 assert start['boot_session_uuid']==current['boot_session_uuid'],'Boot context changed'
 mono=(current['monotonic_ns']-start['monotonic_ns'])/1_000_000_000
 utc=(datetime.fromisoformat(current['utc'])-datetime.fromisoformat(start['utc'])).total_seconds()
 assert math.isfinite(mono) and math.isfinite(utc) and 0<=mono<240 and 0<=utc<240,'Original START lease expired or clock regressed'
 assert abs(mono-utc)<=1,'Detected clock drift exceeds one-second sampling tolerance'
 return min(240-mono,240-utc)
