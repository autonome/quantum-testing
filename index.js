const puppeteer = require('puppeteer');
const puppeteerFx = require('./puppeteer-fx');

const chromePath = '/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome';
const chromeCanaryPath = '/Applications/Google\ Chrome\ Canary.app/Contents/MacOS/Google\ Chrome\ Canary';

const firefox50Path= '/Applications/Firefox\ 50.app/Contents/MacOS/firefox';
const firefox54Path= '/Applications/Firefox\ 54.app/Contents/MacOS/firefox';
const firefox56Path= '/Applications/Firefox\ 56.app/Contents/MacOS/firefox';
const firefox57Path= '/Applications/Firefox\ Beta.app/Contents/MacOS/firefox';
const firefox58Path= '/Applications/FirefoxNightly.app/Contents/MacOS/firefox';

//const speedometerURL = 'https://mozilla.github.io/arewefastyet-speedometer/2.0/';
const speedometerURL = 'http://localhost/arewefastyet-speedometer/2.0/';
 
const testConfigDebug = {
  iterations: 1,
  measureCPUTime: false,
  measureDiskIO: false,
 
  /*
  // network
  throttling: {
    downloadThroughput: 75000,
    uploadThroughput: 25000,
    latency: 100
  },
  */

  // sleeps
  afterSuiteRun: 1000,
  afterPageRun: 3000,
  afterBrowserLaunch: 3000,
  afterPageNavigate: 3000,

  url: speedometerURL,
  //onPage: speedometerHandler
  //
  onPage: async function(page) {
    console.log('ONPAGE');
    await sleep(10000);
    console.log('ONPAGEdone');
    return 28.7;
  }
  //
};


// TODO: deterministicize waiting for the start button, at least
async function speedometerHandler(page) {
  //console.log('speedometerHandler')

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

      return +vals.result;
    }
    else {
      await sleep(5000);
    }
  }
}

const testConfigProd = {
  iterations: 5,
  measureCPUTime: true,
  measureDiskIO: true,

  throttling: {
    downloadThroughput: 75000,
    uploadThroughput: 25000,
    latency: 100
  },
  
  // sleeps
  afterSuiteRun: 3000,
  afterPageRun: 3000,
  afterBrowserLaunch: 3000,
  afterPageNavigate: 3000,

  // content
  url: speedometerURL,
  onPage: speedometerHandler
};

//const testConfig = testConfigDebug;
const testConfig = testConfigProd;

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
    title: 'Firefox50',
    browser: 'firefox',
    puppeteerOpts: {
      userDataDir: './profile-firefox-50',
      executablePath: firefox50Path,
      headless: false
    }
  },
  */
  //
  {
    title: 'Firefox54',
    browser: 'firefox',
    puppeteerOpts: {
      userDataDir: './profile-firefox-54',
      executablePath: firefox54Path,
      headless: false
    }
  },
  //
  /*
  {
    title: 'Firefox56',
    browser: 'firefox',
    puppeteerOpts: {
      userDataDir: './profile-firefox-56',
      executablePath: firefox56Path,
      headless: false
    }
  },
  */
  /*
  {
    title: 'Firefox57',
    browser: 'firefox',
    puppeteerOpts: {
      userDataDir: './profile-firefox-57',
      executablePath: firefox57Path,
      headless: false
    }
  },
  */
  /*
  {
    title: 'Firefox58',
    browser: 'firefox',
    puppeteerOpts: {
      userDataDir: './profile-firefox-58',
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

// TODO: have config provide custom flattener
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
        result.pageResults, // speedometer
        result.cpuTime, // cpu time
        result.ioResults.reads.count,
        result.ioResults.reads.bytes,
        result.ioResults.writes.count,
        result.ioResults.writes.bytes,
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
    suite[i].error = '';
    suite[i].results = [];
    try {
      // Apply global config options to browser run
      Object.keys(cfg).forEach(key => {
        suite[i][key] = testConfig[key];
      });
      if (cfg.throttling) {
        suite[i]['puppeteerOpts'].throttling = cfg.throttling;
      }
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
  let exceptions = [];
  let retries = cfg.iterations;
  for (let i = 0; i < cfg.iterations; i++) {
    console.log('runBrowserTest', cfg.title, cfg.iterations, i);
    try {
      const result = await runPageTest(cfg);
      console.log('runPageTest Result', cfg.browser, result);
      results.push(result);
      // TODO: deterministicize if possible
      await sleep(cfg.afterPageRun);
    }
    catch(ex) {
      console.log('runPageTest error', ex);
      console.log('retries', retries, i);
      // retry...
      if (retries > 0) {
        // Save the error
        exceptions.push(ex);
        // Force another pass through the loop
        if (i > 0)
          i--;
        // Only try a set number of times per run
        // (same number as iterations)
        retries--;
        // Chill before retrying
        console.log('chill and then retry', retries, i);
        await sleep(cfg.afterPageRun);
      }
      else {
        throw(exceptions);
      }
    }
  }
  //console.log('Browser Test Results', cfg, results);
  return results;
}

// Open a page once while measuring certain aspects, until a handler
// returns its results.
// TODO: deterministicize browser.close() - is promise? puts off onto puppeteer impl
async function runPageTest(cfg) {
  let exception, browser,
      page, pageResults,
      cpuProc, cpuTime = 0,
      ioProc, ioResults = {
        reads: { bytes: 0, count: 0},
        writes: {bytes: 0, counts: 0}
      };

  try {
    //console.log('runPageTest, launching browser');
    let purpleteer = cfg.browser == 'firefox' ? puppeteerFx : puppeteer;
    browser = await purpleteer.launch(cfg.puppeteerOpts);
    //console.log('launched browser');
    page = await browser.newPage();
    //console.log('got browser, going to sleep');
    await sleep(cfg.afterBrowserLaunch);
    //console.log('after sleep');

    console.log('attempting navigation');
    // TODO: wtf why firefox fail
    await page.goto(cfg.url);
    console.log('navigated to', cfg.url);

    // Wait for page to fully load and browser init stuff to complete
    await sleep(cfg.afterPageNavigate);

    // Start measuring CPU time
    if (cfg.measureCPUTime) {
      measureCPUTime(cfg.browser, (process, time) => {
        cpuProc = process;
        cpuTime = time;
      });
    }

    // Start measuring disk IO
    if (cfg.measureDiskIO) {
      measureDiskIO(cfg.browser, (process, results) => {
        ioProc = process;
        ioResults = results;
      });
    }

    // Start test
    pageResults = await cfg.onPage(page);
    //console.log('onPage results', pageResults);

  }
  catch(ex) {
    exception = ex;
    console.log('Error running page test', ex);
  }

  //console.log('browser closinggggg');
  // TODO: add await back in
  if (browser) {
    await browser.close();
    //console.log('browser closed');
  }
  else if (exception != null) {
    throw('no browser to close!');
  }

  if (cfg.measureCPUTime) {
    //console.log('configured for cpu, so killing');
    if (cpuProc) {
      cpuProc.kill();
      //console.log('cpu proc killed');
    }
    else if (exception != null) {
      throw('no cpu process to kill!');
    }
  }

  if (cfg.measureDiskIO) {
    //console.log('configured for io, so killing');
    if (ioProc) {
      killemall(ioProc);
      //console.log('io proc killed', ioProc.killed);
    }
    else if (exception != null) {
      throw('no io process to kill!');
    }
  }

  if (exception != null) {
    //console.log('page test throwing', exception);
    throw(exception);
  }
  else {
    //console.log('page test successful');
    return {pageResults, cpuTime, ioResults};
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

    //console.log('fieldData foreach', fieldData.length)
    fieldData.forEach(entry => {
      var direction = entry[7] == 'W' ? 'writes' : 'reads';
      tallies[direction].count++;
      tallies[direction].bytes += +entry[8]; 
    });
    //console.log('end fieldData foreach')

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
      process.kill();
      console.log('CPUTIME', cpuTime);
    }
  });
})();
```

*/
async function measureCPUTime(browser, callback) {
  const matchParent = browser == 'firefox' ? 'firefox' : '"^Google\ Chrome\ Ca"';
  const matchAll = browser == 'firefox' ? 'firefox|plugin-container' : 'Chrome';

  const ppidCmd = 'pgrep ' + matchParent;
  const ppid = await runCommand(ppidCmd);
  //console.log('ppidcmd', ppidCmd, ppid);

  const kidPidsCmd = 'pgrep -P ' + ppid;
  const kidPidsStr = await runCommand(kidPidsCmd);
  //console.log('kpidcmd', kidPidsStr);

  let pids = ppid.trim().split('\n').concat(kidPidsStr.trim().split('\n'));

  const allPidsStr = '-pid '+ pids.join(' -pid ');

  const topCmd = 
    'top ' +
    allPidsStr +
    ' -F -R ' +
    ' -l 0 ' +
    '-stats "pid,command,cpu,time,mem,purg"';
  
  //console.log('top cmd', topCmd);

  runCommand(topCmd, (child, data) => {
    //console.log(data);
    let lines = data.split('\n').filter(line => (new RegExp(matchAll, 'i')).test(line));

    if (browser == 'chrome') {
      lines = lines.map(line => line.replace(/Google Chrome (Ca|He)/, 'Google-Chrome-He'));
    }

    // array of arrays of [0] pid, [1] command, [2] cpu, [3] time, [4] mem, [5] purg
    const byProcess = lines.map(line => line.trim().split(/ +/));

    if (byProcess.length > 1) {
      const cpuTimes = byProcess.map(process => [process[1], timeToSeconds(process[3])]);
      const totalCPUTime = byProcess.reduce((sum, process) => sum + timeToSeconds(process[3]), 0);
      //console.log('CPU', totalCPUTime, cpuTimes);
      callback(child, totalCPUTime);
    }
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
        child.kill();
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

// http://krasimirtsonev.com/blog/article/Nodejs-managing-child-processes-starting-stopping-exec-spawn
function killemall(proc) {
	const psTree = require('ps-tree');

	function kill(pid, signal, callback) {
			signal   = signal || 'SIGKILL';
			callback = callback || function () {};
			var killTree = true;
			if(killTree) {
					psTree(pid, function (err, children) {
							[pid].concat(
									children.map(function (p) {
											return p.PID;
									})
							).forEach(function (tpid) {
									try { process.kill(tpid, signal) }
									catch (ex) { }
							});
							callback();
					});
			} else {
					try { process.kill(pid, signal) }
					catch (ex) { }
					callback();
			}
	}

	kill(proc.pid);
}
