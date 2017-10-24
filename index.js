const puppeteer = require('puppeteer');
const puppeteerFx = require('./puppeteer-fx');

const chromePath = '/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome';
const chromeCanaryPath = '/Applications/Google\ Chrome\ Canary.app/Contents/MacOS/Google\ Chrome\ Canary';

const firefox54Path= '/Applications/Firefox54.app/Contents/MacOS/firefox';
const firefox56Path= '/Applications/Firefox.app/Contents/MacOS/firefox';
const firefox57Path= '/Applications/Firefox\ Beta.app/Contents/MacOS/firefox';
const firefox58Path= '/Applications/FirefoxNightly.app/Contents/MacOS/firefox';

//const speedometerURL = 'https://mozilla.github.io/arewefastyet-speedometer/2.0/';
const speedometerURL = 'http://localhost/arewefastyet-speedometer/2.0/';
 
const afterSuiteRun = 2000;
const afterPageRun = 2000;
const afterBrowserLaunch = 2000;
const afterPageNavigate = 2000;
const contentCheckInterval = 5000;

const testConfigDebug = {
  iterations: 1,
  measureCPUTime: false,
  measureDiskIO: false,

  // sleeps
  afterSuiteRun: 1000,
  afterPageRun: 1000,
  afterBrowserLaunch: 1000,
  afterPageNavigate: 1000,
  contentCheckInterval: 5000
};

const testConfigProd = {
  iterations: 5,
  measureCPUTime: true,
  measureDiskIO: true,
  
  // sleeps
  afterSuiteRun: 5000,
  afterPageRun: 5000,
  afterBrowserLaunch: 10000,
  afterPageNavigate: 5000,
  contentCheckInterval: 5000
};


const testConfig = testConfigDebug;
//const testConfig = testConfigProd;

const testSuite = [
  /*
  {
    title: 'Chrome61',
    browser: 'chrome',
    puppeteerOpts: {
      executablePath: chromePath,
      headless: false
    }
  },
  */
  /*
  {
    title: 'Chrome64',
    browser: 'chrome',
    puppeteerOpts: {
      userDataDir: './profile-chrome-64',
      executablePath: chromeCanaryPath,
      headless: false
    }
  },
  */
  /*
  {
    title: 'Firefox54',
    browser: 'firefox',
    puppeteerOpts: {
      executablePath: firefox54Path,
      headless: false
    }
  },
  */
  /*
  {
    title: 'Firefox56',
    browser: 'firefox',
    puppeteerOpts: {
      //userDataDir: './profile-firefox-56',
      executablePath: firefox56Path,
      headless: false
    }
  },
  */
  //
  {
    title: 'Firefox57',
    browser: 'firefox',
    puppeteerOpts: {
      executablePath: firefox57Path,
      headless: false
    }
  },
  //
  /*
  {
    title: 'Firefox58',
    browser: 'firefox',
    puppeteerOpts: {
      executablePath: firefox58Path,
      headless: false
    }
  }
  */
];

// MAIN()
(async () => {
  var results = await runTestSuite(testSuite, testConfig);
  const util = require('util')
  //console.log(util.inspect(results, { depth: null }));
  console.log(toCSV(results));
  var fs = require('fs');
  fs.writeFile('results.csv', toCSV(results), function(err) {
    if (err) {
      return console.log(err);
    }
  });
})();

/*
[ { title: 'Chrome 64',
    browser: 'chrome',
    iterations: 1,
    measureCPUTime: false,
    measureDiskIO: false,
    puppeteerOpts: 
     { executablePath: '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
       headless: false },
    results: [ [ 56.05, 0, undefined ] ] } ]
*/
function toCSV(results) {
  var rows = [];
  rows.push([
    'title',
    'browser',
    'executable',
    'speedometer',
    'cputime',
    'readscount',
    'readsbytes',
    'writescount',
    'writesbytes',
    'error'
  ].join(','));
	results.forEach(browserResult => {
    browserResult.results.forEach(result => {
      rows.push([
        browserResult.title,
        browserResult.browser,
        browserResult.puppeteerOpts.executablePath,
        result[0], // speedometer
        result[1], // cpu time
        result[2].reads.count,
        result[2].reads.bytes,
        result[2].writes.count,
        result[2].writes.bytes,
        browserResult.error || ''
      ].join(','));
    });
	});
  return rows.join('\n');
}

// Run an entire test suite
async function runTestSuite(suite, cfg) {
  let results = [];
  for (var i = 0; i < suite.length; i++) {
    try {
      // Apply global config options to browser run
      Object.keys(cfg).forEach(key => {
        suite[i][key] = testConfig[key];
      });
      const result = await runBrowserTest(suite[i]); 
      suite[i].results = result;
    }
    catch(ex) {
      suite[i].error = ex;
    }
    //console.log('suite result', suite[i]);
    results.push(suite[i]);
    await sleep(cfg.afterSuiteRun);
  }
  //console.log('Suite Results', results);
  return results;
}

// Run test n times with the specified browser
async function runBrowserTest(cfg) {
  let results = [];
  for (let i = 0; i < cfg.iterations; i++) {
    const result = await runSpeedometer(cfg);
    //console.log('Speedometer Result', cfg.browser, result);
    results.push(result);
    // Wait 10s between runs
    // TODO: deterministicize if possible
    await sleep(5000);
  }
  //console.log('Browser Test Results', cfg, results);
  return results;
}

// Run Speedometer once, return result.
// TODO: deterministicize waiting for the start button, at least
// TODO: deterministicize browser.close() - is promise? puts off onto puppeteer impl
async function runSpeedometer(cfg) {
  console.log('runSpeedometer, launching browser...');
  let purpleteer = cfg.browser == 'firefox' ? puppeteerFx : puppeteer;
  const browser = await purpleteer.launch(cfg.puppeteerOpts);
  console.log('launched');
  const page = await browser.newPage();
  console.log('got browser, going to sleep');
  await sleep(3000);
  console.log('after sleep');

  console.log('attempting navigation');
  // TODO: wtf why firefox fail
  await page.goto(speedometerURL);
  console.log('navigated to', speedometerURL);

  // Wait for page to fully load and browser init stuff to complete
  await sleep(15000);

  // Start measuring CPU time
  var cpuProc, cpuTime = 0; 
  if (cfg.measureCPUTime) { 
    measureCPUTime(cfg.browser, (process, time) => {
      cpuProc = process;
      cpuTime = time;
    });
  }

  // Start measuring disk IO
  var ioProc, ioResults;
  if (cfg.measureDiskIO) { 
    measureDiskIO(cfg.browser, (process, results) => {
      ioProc = process;
      ioResults = results;
    });
  }

  // Start test
  page.evaluate('document.querySelector(\'section#home div.buttons button\').click()');

  // Periodically check for results
  while (true) {
    const vals = await page.evaluate(() => {
      return {
        progress: document.querySelector('#progress-completed').style.width,
        result: document.querySelector('#result-number').innerText
      };
    });

    if (vals.result.length > 0) {
      console.log('closinggggg');
      await browser.close();
      console.log('closed');

      if (cfg.measureCPUTime) {
        cpuProc.kill('SIGHUP');
      }

      if (cfg.measureDiskIO) {
        ioProc.kill('SIGHUP');
      }

      return [+vals.result, cpuTime, ioResults];
    }
    else {
      await sleep(5000);
    }
  }
}

function sleep(ms) {
  return new Promise((r, e) => {
    setTimeout(r, ms);
  });
}

async function measureDiskIO(browser, callback) {
  const matchAll = browser == 'firefox' ? 'firefox|plugin-container' : 'Chrome';

  const iotopCmd = 'sudo iotop -C';
  //console.log('iotop cmd', iotopCmd);

  let tallies = {
    reads: {
      count: 0,
      bytes: 0
    },
    writes: {
      count: 0,
      bytes: 0
    }
  };


  runCommand(iotopCmd, (child, data) => {
    let lines = data.split('\n').filter(line => (new RegExp(matchAll, 'i')).test(line));

    if (browser == 'chrome') {
      lines = lines.map(line => line.replace(/Google Chrome (Ca|He)/, 'Google-Chrome-He'));
    }

		/*
  	UID    PID   PPID CMD              DEVICE  MAJ MIN D            BYTES
  	501  24125      1 Google Chrome Ca ??        1   4 W            61440

    array of arrays of:
		  [0] UID, [1] PID, [2] PPID,
      [3] CMD, [4] DEVICE, [5] MAJ
      [6] MIN, [7] D, [8] BYTES

    */
    const fieldData = lines.map(line => line.trim().split(/ +/));

    fieldData.forEach(entry => {
      var direction = entry[7] == 'W' ? 'writes' : 'reads';
      tallies[direction].count++;
      tallies[direction].bytes += +entry[8]; 
    });

    callback(child, tallies);
  });
}

/*

Measure aggregate CPU time across a process and its children
over the length of time you let this command run, before
killing it.

Don't forget to kill the process.

Usage:

```
(async () => {
  var secs = 5000;
  measureCPUTime('firefox', (process, cpuTime) => {
    await sleep(secs);
    secs -= 1000;
    console.log('secs', secs);
    if (secs < 0) {
      process.kill('SIGHUP');
      console.log('CPUTIME', cpuTime);
    }
  });
})();
```

*/
async function measureCPUTime(browser, callback) {
  const matchParent = browser == 'firefox' ? 'firefox' : 'Canary?';
  const matchAll = browser == 'firefox' ? 'firefox|plugin-container' : 'Chrome';

  const ppidCmd = 'pgrep ' + matchParent;
  const ppid = await runCommand(ppidCmd);

  const kidPidsCmd = 'pgrep -P ' + ppid;
  const kidPidsStr = await runCommand(kidPidsCmd);

  let pids = ppid.trim().split('\n').concat(kidPidsStr.trim().split('\n'));

  const allPidsStr = '-pid '+ pids.join(' -pid ');

  const topCmd = 
    'top ' +
    allPidsStr +
    ' -F -R -a ' +
    ' -l 0 ' +
    '-stats "pid,command,cpu,time,mem,purg"';
  
  //console.log('top cmd', topCmd);

  runCommand(topCmd, (child, data) => {
    let lines = data.split('\n').filter(line => (new RegExp(matchAll, 'i')).test(line));
    if (browser == 'chrome') {
      lines = lines.map(line => line.replace(/Google Chrome (Ca|He)/, 'Google-Chrome-He'));
    }

    // array of arrays of [0] pid, [1] command, [2] cpu, [3] time, [4] mem, [5] purg
    const byProcess = lines.map(line => line.trim().split(/ +/));

    const totalCPUTime = byProcess.reduce((sum, process) => sum + timeToSeconds(process[3]), 0); 

    callback(child, totalCPUTime);
  });
}

function runCommand(cmd, onData) {
  return new Promise((res, rej) => {
    const exec = require('child_process').exec;
    const child = exec(cmd);
    /*
    const child = exec(cmd, (error, stdout, stderr) => {
      console.log('runCommand() ERROR', error);
      console.log('runCommand() stdout', stdout);
    });
    child.stdout.on('data', console.log);
    child.stderr.on('data', console.log);
    */
    if (onData) {
      child.stdout.on('data', (data) => {
        // test data, resolve if null?
        onData(child, data);
      });
      /*
      child.on('error', (err) => {
        console.log('onError', err);
      });
      */
    }
    else {
      let output = '';
      child.stdout.on('data', function(data) {
        if (data) {
          output += data;
        }
      });
      child.stdout.on('end', () => {
        child.kill('SIGHUP');
        res(output);
      });
    }
  });
}

function timeToSeconds(hms) {
  var a = hms.split(':'); // split it at the colons
  if (a.length == 2) {
    a.unshift('00');
  }
  var seconds = (+a[0]) * 60 * 60 + (+a[1]) * 60 + (+a[2]);
  return seconds;
}
