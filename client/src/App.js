import React, {Component} from "react";
import Combobox from "react-widgets/lib/Combobox";
import DropdownList from "react-widgets/lib/DropdownList";
import "./App.css";
import "react-widgets/dist/css/react-widgets.css";
import socketIO from "socket.io-client";
import cookie from "cookie";

class App extends Component {

  constructor(props) {
    super(props);

    const cookiedInstanceName = cookie.parse(document.cookie).instance;
    this.state = {
      currentInstance: cookiedInstanceName ? cookiedInstanceName : '',
      branchNameToChange: '',
      moreMenuAction: null,
      dumpToUse: '',
      enteredInstanceURL: '',
      loginError: '',
      instanceData: {
        state: '',
        currentBranchName: '',
        branches: [],
        dumps: []
      },
      log: '',
      autoScroll: true,
      maximized: false
    };

    this.io = null;

    if (cookiedInstanceName) {
      this.loadInstanceData();
      this.initializeWebSocket();
    }
  }

  changeBranch = () => {
    const branch = this.state.branchNameToChange;
    const dump = this.state.dumpToUse;
    const _this = this;
    fetch(this.state.currentInstance + ':3002/deploy/' + encodeURI(branch) + '?dump=' + encodeURI(dump), {
      method: 'get'
    }).then((resp) => resp.json())
      .then(function (response) {
        if (response.success) {
          _this.state.instanceData['currentBranchName'] = branch;
          _this.setState({instanceData: _this.state.instanceData});
        }
      }).catch(err => {
      console.log(err);
    });
  };

  addLogLine = (msg) => {
    let log = this.state.log;
    log += msg + (msg.endsWith('\n') ? '' : '\n');

    const nLines = log.split(/\r\n|\r|\n/).length;
    for (let i = nLines; i > 200; i--)
      log = log.substring(log.indexOf('\n') + 1);

    this.setState({log: log});
  };

  initializeWebSocket = () => {
    const _this = this;

    fetch(this.state.currentInstance + ':3002/readLog', {
      method: 'get'
    }).then((resp) => resp.json())
      .then(function (response) {
        const logLines = response.logLines;
        for (let i = 0; i < logLines.length; i++)
          _this.addLogLine(logLines[i]);

        _this.io = new socketIO(_this.state.currentInstance + ':3002');
        _this.io.on('log', _this.addLogLine);
        _this.io.on('status', function (msg) {
          _this.state.instanceData['state'] = msg;
          _this.setState({instanceData: _this.state.instanceData});
        });
      }).catch(err => {
      console.log(err);
    });
  };

  logIn = () => {
    const _this = this;
    let chosenInstance = this.state.enteredInstanceURL;
    if (!chosenInstance)
      this.setState({loginError: 'Please enter instance URL'});
    else {
      if (!chosenInstance.startsWith('http'))
        chosenInstance = 'http://' + chosenInstance;

      fetch(chosenInstance + ':3002/ping', {
        method: 'get'
      }).then((resp) => resp.json())
        .then(function (response) {
          if (response.success) {
            document.cookie = cookie.serialize("instance", chosenInstance);
            _this.setState({
              loginError: '',
              currentInstance: chosenInstance,
              enteredInstanceURL: ''
            }, function () {
              _this.loadInstanceData();
              _this.initializeWebSocket();
            });
          }
        }).catch(err => {
        _this.setState({loginError: 'Could not connect to instance ' + chosenInstance});
      });
    }
  };

  logOut = () => {
    document.cookie = cookie.serialize("instance", '');
    this.setState({currentInstance: ''});
    if (this.io) {
      this.io.removeAllListeners('log');
      this.io.removeAllListeners('status');
    }
  };

  loadInstanceData = () => {
    const _this = this;
    fetch(this.state.currentInstance + ':3002/getInstanceData', {
      method: 'get'
    }).then((resp) => resp.json())
      .then(function (response) {
        if (response.success) {
          _this.setState({instanceData: response.data});
        }
      }).catch(err => {
      console.log(err);
    });
  };

  scrollToBottom = () => {
    if (this.state.autoScroll)
      this.logEnd.scrollIntoView({behavior: "smooth"});
  };

  toggleAutoScroll = () => {
    this.setState({autoScroll: !this.state.autoScroll});
  };

  viewEntireLog = () => {
    window.open(this.state.currentInstance + ':3002/viewEntireLog', '_blank');
  };

  clearLog = () => {
    this.setState({log: ''});
  };

  toggleMaximized = () => {
    this.setState({maximized: !this.state.maximized});
  };

  moreMenuItemSelected = (value) => {
    if (value === 'Log out')
      this.logOut();
    else if (value === 'Backup database')
      this.dbBackup();

    this.setState({moreMenuAction: null});
  };

  dbBackup = () => {
    const _this = this;
    fetch(this.state.currentInstance + ':3002/dbBackup', {
      method: 'get'
    }).then((resp) => resp.json())
      .then(function (response) {
        if (response.success) {
          _this.state.instanceData['dumps'].push(response.newDbBackupName);
          _this.setState({instanceData: _this.state.instanceData});
        }
      }).catch(err => {
      console.log(err);
    });
  };

  componentDidMount() {
    this.scrollToBottom();
  }

  componentDidUpdate() {
    this.scrollToBottom();
  }

  renderContent = () => {
    if (this.state.currentInstance) {
      return (<div>
        <p>
          Instance:
          <a href={this.state.currentInstance + ":8080"}>
            <span className="value">{this.state.currentInstance}:8080</span>
          </a>
        </p>
        <p>
          Status: <span className="value">{this.state.instanceData.state}</span>
        </p>
        <p>
          Branch currently deployed: <span className="value">{this.state.instanceData.currentBranchName}</span>
        </p>
        <div className="deployment">
          <div>
            <Combobox
              data={this.state.instanceData.branches}
              value={this.state.branchNameToChange}
              onChange={value => this.setState({branchNameToChange: value})}
              suggest={true}
              placeholder="Branch name"
            />
            <Combobox
              data={this.state.instanceData.dumps}
              value={this.state.dumpToUse}
              onChange={value => this.setState({dumpToUse: value})}
              suggest={true}
              placeholder="Optional DB rollback"
              className="dumps"
            />
            <button onClick={this.changeBranch}>Deploy</button>
          </div>
        </div>
        <div className="small-buttons">
          <button onClick={this.toggleAutoScroll}>Auto-scroll: {this.state.autoScroll ? 'On' : 'Off'}</button>
          <button onClick={this.toggleMaximized}>{this.state.maximized ? 'Normal' : 'Maximize'}</button>
          <button onClick={this.clearLog}>Clear</button>
          <button onClick={this.viewEntireLog}>View entire log</button>
        </div>
      </div>);
    }

    return (<div>
      <p>
        <input type="text" className="text-field" placeholder="Instance URL (without port)"
               value={this.enteredInstanceURL}
               onChange={event => this.setState({enteredInstanceURL: event.target.value})}/>
        <button onClick={this.logIn}>Connect</button>
      </p>
      <p>
        {this.state.loginError}
      </p>

    </div>);
  };

  render() {
    return (
      <div className={'App ' + (this.state.maximized ? 'maximized' : '')}>
        <header>
          <DropdownList data={['Log out', 'Backup database']}
                        className={'more-menu ' + (this.state.currentInstance ? '' : 'hidden')} placeholder="More"
                        onChange={this.moreMenuItemSelected} value={this.state.moreMenuAction}/>
          <h1>Test Instance Manager</h1>
          <h2>for Cascade CMS</h2>
        </header>
        <div className="content space">
          {this.renderContent()}

        </div>
        <pre>
          {this.state.currentInstance ? this.state.log : ''}
          <div style={{float: "left", clear: "both"}} ref={(el) => {
            this.logEnd = el;
          }}>
            </div>
          </pre>
      </div>
    );
  }
}

export default App;
