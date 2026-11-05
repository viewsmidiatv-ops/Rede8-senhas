#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p build/tests
javac --release 8 -encoding UTF-8 -d build/tests app/src/main/java/com/viewsmidia/player/PlayerRules.java tests/PlayerRulesTest.java
java -cp build/tests PlayerRulesTest
javac --release 8 -encoding UTF-8 -classpath build/zxing-core-3.5.3.jar -d build/tests tests/QrCodeTest.java
java -cp build/tests:build/zxing-core-3.5.3.jar QrCodeTest
