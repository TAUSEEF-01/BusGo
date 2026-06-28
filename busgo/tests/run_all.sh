#!/usr/bin/env bash
# BusGo test commands. Run from busgo/tests/  (Git Bash / Linux / macOS).
#   ./run_all.sh            # run everything
#   ./run_all.sh unit       # only unit tests
#   ./run_all.sh load       # only load-balancing
#   ./run_all.sh concurrency# only seat-concurrency
#   ./run_all.sh status     # only current load / replica health
#
# Override gateway location if needed:
#   KONG_URL=http://localhost:18085 KONG_ADMIN_URL=http://localhost:18089 ./run_all.sh

set -e
cd "$(dirname "$0")"

CMD="${1:-all}"

case "$CMD" in
  unit)        python run_tests.py unit ;;
  load)        python run_tests.py load ;;
  concurrency) python run_tests.py concurrency ;;
  status)      python run_tests.py status ;;
  all)
    python run_tests.py unit
    python run_tests.py load
    python run_tests.py concurrency
    python run_tests.py status
    ;;
  *)
    echo "Usage: ./run_all.sh [unit|load|concurrency|status|all]"
    exit 1
    ;;
esac
