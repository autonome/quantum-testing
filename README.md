# Quantum Measurements

Collect data...

* for a process + children
* over time
* across all cores
* saved to file as csv log

for...

* CPU
* Memory
* Disk IO
* Power

while...

* running Speedometer 2.0

## Harness

* Record
* ... cpu time
* ... disk reads/writes
* ... network activity
* While running Speedometer
* ... on Firefox / Chrome
* ... a configurable number of times
* ... fetching results and storing them
* ... for later processing

Implementation

* Node script
  * Opens browser
  * Loads Speedometer
  * Runs test n times
  * Writes results to csv

## TODO

Tool

* make url and in-page evaluations configurable (start/stop conditions)

Network
* figure out easiest way to simulate slow network
* compare speedometer runs between versions on throttled network
* what other tests? overall bytes sent/received? overall requests made?
* figure out whether to further investigate
* maybe tp pageset instead of speedometer?

## Notes

### Firefoxes

* Relnotes: https://www.mozilla.org/en-US/firefox/releases/
* Builds: https://ftp.mozilla.org/pub/firefox/releases/

### CPU

https://github.com/mozilla/energia

https://wiki.mozilla.org/Performance/Project_Candle

https://blogs.windows.com/msedgedev/2016/06/20/edge-battery-anniversary-update/

https://en.wikipedia.org/wiki/CPU_time

### network

Node
* puppeteer - in api
* foxdriver - in actor, might need to wire up

Proxies
* https://www.npmjs.com/package/throttle-proxy
* https://www.charlesproxy.com/documentation/proxying/throttling/
* http://www.proxypony.com/

OS
* Mac http://hbrouwer.github.io/lensosx/
* Mac http://nshipster.com/network-link-conditioner/
* Win https://jagt.github.io/clumsy/

Router
* http://wanem.sourceforge.net/
* https://www.polidea.com/blog/Simulating_cellular_data_network_over_Wifi/
* https://facebook.github.io/augmented-traffic-control/

Browser
* https://developers.google.com/web/tools/chrome-devtools/network-performance/reference#throttling

Articles
* https://packetzoom.com/blog/how-to-test-your-app-in-different-network-conditions.html
* https://www.hanselman.com/blog/HowToSimulateALowBandwidthConnectionForTestingWebSitesAndApplications.aspx

### Filesystem reads/writes

Easy first stab is to record bytes written & bytes read in activity monitor for the processes.

fs_usage

https://stackoverflow.com/questions/15786618/per-process-disk-read-write-statistics-in-mac-os-x#16451377
```
sudo fs_usage -f filesys
```
Blunt test is log this to file and then count rows in file for sheer volume of operations. Meaningful?

-w shows full pathnames

all writes: sudo fs_usage -w -f diskio firefox|grep -i wrdata
all writes: sudo fs_usage -w -f diskio firefox|grep -i rdmeta/rddata

good overview
https://apple.stackexchange.com/questions/196575/fs-usage-returns-a-lot-of-ioctl-lines/196602#196602

some log analysis commands
http://toddsnotes.blogspot.in/2014/02/use-fsusage-to-monitor-file-system.html

iotop

iotop groups by process and gives totals
http://osxdaily.com/2012/01/20/monitor-disk-activity-in-mac-os-x/
```
iotop -C 3 10
```

For iotop, need to disable SIP to use it
https://www.igeeksblog.com/how-to-disable-system-integrity-protection-on-mac/

Working:

sudo iotop -C | grep "firefox\|plugin-container"

Then group on reads/writes

### Getting pid by process name

snippet to get pid from process name dynamically
https://stackoverflow.com/questions/3727793/limit-the-output-of-the-top-command-to-a-specific-process-name
(-pid instead of -p on Mac)
```
top -p `pgrep process-name | tr "\\n" "," | sed 's/,$//'`
```

### Batch/logging results for Top

top batch usage on mac (get info once and quit)
```
top -l 1
```

note: the first sample displayed will have an invalid %CPU displayed for each process, as it is calculated using the delta between samples.

so do: ```top -l 2``` and throw away the first result

to run in logging mode (0 means indefinitely):
```
top -l 0

```

more batching tips
https://stackoverflow.com/questions/11729720/how-to-capture-the-output-of-a-top-command-in-a-file-in-linux

### Aggregating parent and child processes

coalesce all parent and all child processes

https://unix.stackexchange.com/questions/209742/show-cpu-core-usage-for-parent-process-and-its-child-processes#209758

get all child pids with pgrep:
```
top -pid $(pgrep -P 2069 -d,)
```

add parent pid at end for catching all
```
top -pid $(pgrep -P 2784 -d" -pid ") 2784
```

more notes on coalescing, and also TIME+
https://serverfault.com/questions/74143/is-there-a-linux-tool-like-top-only-cumulative

### CPU values

making sure to get current cpu usage, not average since process start
http://www.touchoftechnology.com/how-to-find-the-current-cpu-usage-in-ubuntu-not-the-average/

TIME+
In cumulative mode (-S), TIME+ is cpu time spent by parent process and all its *dead* child processes.
https://serverfault.com/questions/348393/time-column-in-top-command-is-inaccurate

For our purposes, could we run speedometer and check the last value in the log
to see how much CPU time was used for the entirety?

### System-wide stats in top

for including system stats output
https://superuser.com/questions/281347/filtering-top-command-output
https://superuser.com/questions/391565/how-to-redirect-values-from-top-command-to-a-file-in-mac-osx

### Measurement overhead

reducing overhead
http://osxdaily.com/2009/10/06/monitoring-cpu-usage-on-your-mac-a-better-top-command/

-F Do not calculate statistics on shared libraries, also known as frameworks.
-R Do not traverse and report the memory object map for each process.
-o cpu Order by CPU usage

top -F -R -o cpu

### erahm's notes on memory measurements

for ram: total_memory = sum_uss(content processes) + sum_rss(parent processes); 
https://github.com/EricRahm/atsy

### filtering top output

picking cols from top output
https://stackoverflow.com/questions/25021851/awk-multiple-columns-of-top
