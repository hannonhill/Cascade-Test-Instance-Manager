const {execSync, spawn} = require('child_process');
const fs = require('fs');
const gulp = require('gulp');
const gutil = require('gulp-util');
const http = require('http');
const yaml = require('node-yaml');
const readLastLines = require('read-last-lines');
const tcpPortUsed = require('tcp-port-used');
const socketIO = require('socket.io');
const url = require("url");

const customSettings = yaml.readSync('./custom-settings.yml');
const s3 = require('gulp-s3-upload')({
  accessKeyId: customSettings.AWS_ACCESS_KEY,
  secretAccessKey: customSettings.AWS_SECRET_KEY
});

let io = null;

const outputHandler = function (command, name, callback) {
  command.stdout.on('data', function (data) {
    gutil.log(name + ': ' + data.toString());
  });

  command.stderr.on('data', function (data) {
    gutil.log(name + ' error: ' + data.toString());
  });

  command.on('exit', function (code) {
    gutil.log(name + ' exited with code ' + code.toString());

    if (callback && typeof callback === "function")
      callback();
  });
}

const remoteOutputHandler = function (command) {
  command.stdout.on('data', function (data) {
    sendWsMessage('log', data.toString());
  });

  command.stderr.on('data', function (data) {
    sendWsMessage('log', 'error: ' + data.toString());
  });
}

const sendResponse = function (response, json) {
  response.writeHead(200, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  });
  response.end(JSON.stringify(json));
}

const handleHttpRequest = function (request, response) {
  try {
    var parsedUrl = url.parse(request.url, true);
    if (parsedUrl.pathname == '/ping') {
      return sendResponse(response, {
        success: true,
      });
    } else if (parsedUrl.pathname == '/getInstanceData') {
      const branch = execSync('git rev-parse --abbrev-ref HEAD', {cwd: '../Cascade'}).toString();
      execSync('git pull', {cwd: '../Cascade'});
      const branchesRaw = execSync('git branch -r', {cwd: '../Cascade'}).toString().split('\n');
      const branches = [];
      for (var i = 1; i < branchesRaw.length - 1; i++)
        branches.push(branchesRaw[i].substring(9));
      const dumps = [];
      const dumpFiles = fs.readdirSync('../dumps');
      for (var i = 0; i < dumpFiles.length; i++)
        if (dumpFiles[i].endsWith('.sql'))
          dumps.push(dumpFiles[i]);

      return sendResponse(response, {
        success: true,
        data: {
          state: readStatus(),
          currentBranchName: branch,
          branches: branches,
          dumps: dumps
        }
      });
    } else if (parsedUrl.pathname == '/readLog') {
      return readLastLines.read('../tomcat/logs/catalina.out', 50).then((lines) => sendResponse(response, {
        success: true,
        logLines: lines.split('\n')
      }));
    } else if (parsedUrl.pathname.startsWith('/deploy')) {
      const branch = parsedUrl.pathname.substring(parsedUrl.pathname.lastIndexOf('/') + 1);
      const dump = parsedUrl.query.dump;
      sendWsMessage('log', 'Switching to branch ' + branch + ' with dump ' + dump);

      //outputHandler(spawn('./switch-to.sh', [branch, 'normal.sql']
      remoteOutputHandler(spawn('./switch-to.sh', [branch, dump], {
        shell: true
      }));

      sendResponse(response, {success: true});
      return setTimeout(function () {
        updateStatus('Redeploying');
      }, 5000);
    } else if (parsedUrl.pathname == '/viewEntireLog') {
      response.writeHead(200, {
        'Content-Type': 'text/plain',
        'Access-Control-Allow-Origin': '*'
      });
      response.end(fs.readFileSync("../tomcat/logs/catalina.out"));
    } else if (parsedUrl.pathname == '/dbBackup') {
      const date = new Date();
      const newDbBackupName = date.getMonth() + '-' + date.getDay() + "-" + date.getFullYear() + '-' + date.getHours() + "-" + date.getMinutes() + '.sql';
      sendWsMessage('log', 'Backing up the database as ' + newDbBackupName);

      remoteOutputHandler(spawn('./create-dump.sh', [newDbBackupName], {
        shell: true
      }));

      sendResponse(response, {success: true, newDbBackupName: newDbBackupName});
    }

    sendResponse(response, {hello: 'world'});
  } catch (e) {
    gutil.log(e);
    sendWsMessage('error', e.message);
    sendResponse(response, {error: e.message});
  }
}

const sendWsMessage = function (type, data) {
  if (!io)
    return;

  io.emit(type, data);
};

const updateStatus = function (newStatus) {
  fs.writeFileSync('status.txt', newStatus);
  sendWsMessage('status', newStatus);
}

const readStatus = function () {
  return fs.readFileSync("status.txt").toString();
}

gulp.task('dev', function () {
  outputHandler(spawn('npm', ['start'], {
    cwd: 'client',
    shell: true
  }), 'client');
});

gulp.task('deploy', function () {
  gutil.log('Compiling client');

  outputHandler(spawn('npm', ['run-script', 'build'], {
    cwd: 'client',
    shell: true
  }), 'client deploy', function () {

    gutil.log('Uploading client');

    gulp.src("client/build/**")
      .pipe(s3({
        Bucket: 'cascade-test-instance-manager-prod',
        ACL: 'public-read'
      }, {
        maxRetries: 5
      }));
  });
})

gulp.task('start-instance-monitor', function () {
  const server = http.createServer(handleHttpRequest);
  io = socketIO(server);
  server.listen(3002);
  updateStatus('');
  setInterval(function () {
    let status = readStatus();
    tcpPortUsed.check(8080).then(function (inUse) {
      if (inUse && status != 'Running')
        updateStatus('Running');
      else if (status != 'Redeploying' && status != 'Idle' && !inUse)
        updateStatus('Idle');
    });
  }, 3000);

  remoteOutputHandler(spawn('tail', ['-f', 'logs/catalina.out'], {
    cwd: '../tomcat',
    shell: true
  }));

});
