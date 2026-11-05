#!/usr/bin/env python3
"""Build the native app with pinned ZXing QR dependency using the official SDK tools + Java 17.
Uses a development certificate only. Keep the keystore to update an installed pilot.
"""
import argparse,os,pathlib,subprocess,zipfile,hashlib,urllib.request,shutil
root=pathlib.Path(__file__).resolve().parents[1]
p=argparse.ArgumentParser();p.add_argument('--sdk',default=os.environ.get('ANDROID_SDK_ROOT',os.environ.get('ANDROID_HOME','')));p.add_argument('--tools');p.add_argument('--android-jar');p.add_argument('--keystore',default=str(pathlib.Path.home()/'.android/debug.keystore'));args=p.parse_args()
sdk=pathlib.Path(args.sdk);tools=pathlib.Path(args.tools) if args.tools else sdk/'build-tools/36.0.0';android=pathlib.Path(args.android_jar) if args.android_jar else sdk/'platforms/android-36/android.jar';key=pathlib.Path(args.keystore)
if not android.is_file() or not (tools/'aapt2').is_file():p.error('Install Android SDK platform 36 and Build Tools 36.0.0, or provide --tools and --android-jar.')
build=root/'build';build.mkdir(exist_ok=True)
for name in ('generated','classes','dex'):
 shutil.rmtree(build/name,ignore_errors=True)
 (build/name).mkdir(exist_ok=True)
def run(*cmd):subprocess.run([str(x) for x in cmd],check=True)
run(tools/'aapt2','compile','--dir',root/'app/src/main/res','-o',build/'resources.zip')
run(tools/'aapt2','link','-I',android,'--manifest',root/'app/src/main/AndroidManifest.xml','-A',root/'app/src/main/assets','--java',build/'generated','-o',build/'unsigned.apk',build/'resources.zip')
dependency=root/'build/zxing-core-3.5.3.jar'
expected='8d8064c1636fdaef7189dd9055c7d59950a8940a12f2293956446ec3c109fd82'
if not dependency.exists():urllib.request.urlretrieve('https://repo.maven.apache.org/maven2/com/google/zxing/core/3.5.3/core-3.5.3.jar',dependency)
if hashlib.sha256(dependency.read_bytes()).hexdigest()!=expected:raise SystemExit('ZXing checksum mismatch')
sources=list((root/'app/src/main/java').rglob('*.java'))+list((build/'generated').rglob('*.java'))
run('javac','--release','8','-encoding','UTF-8','-classpath',str(android)+os.pathsep+str(dependency),'-d',build/'classes',*sources)
run(tools/'d8','--min-api','26','--lib',android,'--output',build/'dex',*sorted((build/'classes').rglob('*.class')),dependency)
with zipfile.ZipFile(build/'unsigned.apk','a') as archive:
 for dex in (build/'dex').glob('*.dex'):archive.write(dex,dex.name,compress_type=zipfile.ZIP_DEFLATED)
run(tools/'zipalign','-f','4',build/'unsigned.apk',build/'aligned.apk')
if not key.exists():
 key.parent.mkdir(parents=True,exist_ok=True)
 run('keytool','-genkeypair','-keystore',key,'-storepass','android','-keypass','android','-alias','androiddebugkey','-dname','CN=Android Debug,O=Android,C=US','-keyalg','RSA','-keysize','2048','-validity','10000')
 os.chmod(key,0o600)
output=build/'Views-TV-0.2.0-piloto.apk'
run(tools/'apksigner','sign','--ks',key,'--ks-key-alias','androiddebugkey','--ks-pass','pass:android','--key-pass','pass:android','--out',output,build/'aligned.apk')
run(tools/'apksigner','verify','--verbose',output)
run(tools/'aapt2','dump','badging',output)
print(output)
