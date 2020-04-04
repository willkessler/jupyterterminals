//
// Modeled on jupyter's terminado.js, but modified a lot for Terminals usage.
// Originally found in the Jupyter Graffiti project, https://github.com/willkessler/jupytergraffiti
//
// xterm, xterm's css and its fit addon were downloaded and originally put in the graffiti code base, from here:
// "xterm.js": "https://unpkg.com/xterm@~3.11.0/dist/xterm.js"
// "xterm.js-fit": "https://unpkg.com/xterm@~3.11.0/dist/addons/fit/fit.js"
// "xterm.js-css": "https://unpkg.com/xterm@~3.11.0/dist/xterm.css"



define ([
  'base/js/utils',
  '/nbextensions/jupyterterminals/js/utils.js',
  '/nbextensions/jupyterterminals/js/localizer.js',
  '/nbextensions/jupyterterminals/js/xterm/xterm.js',
  '/nbextensions/jupyterterminals/js/xterm/addons/fit/fit.js',
], (jupyterUtils, utils, localizer, terminalLib, fit) => {
  const terminals = {

    focusedTerminal: undefined,
    discoveredPwd: undefined,
    singleInitialCommand: false, // set to true if you want to only send the startup command to the first terminal found
    defaultTerminalRows: 6,
    defaultTerminalInitialCommand: '',
    defaultButtonCommand: 'echo "Hello World"',
    fitRetryTime: 1000,
    maxRefitAttempts: 10,
    initialCommandCount: 0,
    terminalsList: {},

    renderTerminalHtml: (opts) => {
      const height = parseInt(opts.width * 0.9);
      const terminalHtml = '<div class="terminal-icon" style="width:' + opts.width + 'px;height:' + height + 'px;">' +
                           '&gt;_' +
                           '</div>';
      return terminalHtml;
    },


    discoverPwd: () => {
      Jupyter.notebook.kernel.execute(
        'pwd',
        { iopub:
                {
                  output: (shellOutput) => {
                    if (shellOutput && shellOutput.content && shellOutput.content.data) {
                      const pathWithTicks = shellOutput.content.data['text/plain']; // for some reason this comes back with single apostrophes around it
                      terminals.discoveredPwd = pathWithTicks.substr(1,pathWithTicks.length-2);
                      terminals.renderAllTerminals(); // only render the terminals after we know the pwd of this notebook
                      terminals.bindAllControlButtons();
                    }
                  }
                }
        },
        {
          silent: false
        }
      );
    },

    _makeTerminal: (element, terminalId, wsUrl, sizeObj) => {
      //console.log('makeTerminal,wsUrl:', wsUrl);
      const ws = new WebSocket(wsUrl);
      terminalLib.applyAddon(fit);
      const term = new terminalLib({
        scrollback: 10000,
        theme: {
          foreground:'white',
          background: '#222',
          // foreground: 'black',
          // background: '#eee',
          selection: '#fff',
          cursor:'#f73',
          cursorAccent: '#f22'
        }
      });
      term.id = terminalId;
      // contents: contains all chars in and out of the terminal over the socket.
      let termObject = {
        socket: ws,
        term: term,
        contents: '',
        socketOpen: false,
        sendQueue: [],
        send: (data) => {
          if (termObject.socketOpen) {
            ws.send(JSON.stringify(['stdin',data]));
          } else {
            termObject.sendQueue.push(data);
          }
        }
      };
      ws.onopen = function(event) {
        termObject.socketOpen = true;
        for (let data of termObject.sendQueue) {
          // Send any commands queued up before the socket was ready, down the pipe
          ws.send(JSON.stringify(['stdin',data]));
        }
        term.on('data', function(data) {
          ws.send(JSON.stringify(['stdin', data]));
        });

        // term.on('keydown', (data) => {
        //  console.log('keypress data:', data);
        // });

        //term.on('scroll', (data) => {
        //console.log('term scroll:', data);
        //});

        // term.on('selection', (data) => {
        //   console.log('term selection:', term.getSelection());
        // });

        term.on('focus', () => {
          //console.log('Terminals: terminal ' + term.id + ' focused');
          terminals.focusedTerminal = term.id;
        });

        term.on('blur', () => {
          // console.log('terminal defocused');
          terminals.focusedTerminal = undefined;
        });

        term.on('refresh', (data) => {
          const checkYdisp = term._core.buffer.ydisp;
          if (term.storedYdisp !== undefined) {
            if (term.storedYdisp != checkYdisp) {
              if (terminals.eventsCallback !== undefined) {
                terminals.eventsCallback({
                  id: term.id,
                  type: 'refresh',
                  scrollLine: checkYdisp
                });
              }
              //console.log('Terminals: terminal refresh delta:', term.storedYdisp, checkYdisp);
            }
          }
          term.storedYdisp = term._core.buffer.ydisp;
        });

        term.open(element);
        term.fit();
        // Send the terminal size to the server.
        ws.send(JSON.stringify(["set_size", term.rows, term.cols,
                                window.innerHeight, window.innerWidth]));

        ws.onmessage = function(event) {
          const json_msg = JSON.parse(event.data);
          switch(json_msg[0]) {
            case "stdout":
              const newChars = json_msg[1];
              term.write(newChars);
              term.storedYdisp = term._core.buffer.ydisp;
              //console.log('received newCharslength:', newChars.length, newChars);
              termObject.contents += newChars;
              if (terminals.eventsCallback !== undefined) {
                terminals.eventsCallback({
                  id: term.id,
                  scrollLine: term.storedYdisp,
                  position: termObject.contents.length,
                  focusedTerminal: terminals.focusedTerminal,
                  firstRecord: false,
                });
              }
              // console.log('termId:', terminalId,'received string of length:', json_msg[1].length, 'from server, contents now has:', termObject.contents);
              break;
            case "disconnect":
              term.write("\r\n\r\n[CLOSED]\r\n");
              break;
          }
        };
      };

      return termObject;
    },

    getFocusedTerminal: () => {
      return terminals.focusedTerminal;
    },

    handleButtonClick: (opts) => {
      const cell = utils.findCellByCellId(opts.sourceCellId);
      const terminalConfig = utils.getCellTerminalConfig(cell);
      const buttonId = opts.buttonId;
      const buttonsConfig = terminalConfig.buttonsConfig[buttonId];
      const terminalCellId = buttonsConfig.targetCellId;
      const terminal = terminals.terminalsList[terminalCellId];
      const terminalCommand = buttonsConfig.command;
      const addCr = buttonsConfig.addCr;
      const fullCommand = terminalCommand + (addCr ? "\n" : '');
      terminal.send(fullCommand);
    },

    bindAllControlButtons: () => {
      const cells = Jupyter.notebook.get_cells();
      let cell, config, terminalCellType, renderedHtml, renderedButton, buttonClass, cellElement;
      let innerCell, buttonId, sourceCellId;
      for (let i = 0; i < cells.length; ++i) {
        cell = cells[i];
        if (cell.cell_type === 'markdown') {
          cell.render();
          config = utils.getCellTerminalConfig(cell);
          if ((config !== undefined) && (config.type === 'markdown')) {
            if (config.buttonsConfig !== undefined) {
              for (let buttonId of Object.keys(config.buttonsConfig)) {
                cellElement = $(cell.element[0]);
                renderedHtml = cellElement.find('.rendered_html');
                buttonClass = '.terminal-button-' + buttonId;
                renderedButton = renderedHtml.find(buttonClass);
                let buttonClickOpts = {
                  sourceCellId: utils.getMetadataCellId(cell.metadata),
                  buttonId: buttonId
                };
                renderedButton.unbind('click').bind('click', () => {
                  terminals.handleButtonClick(buttonClickOpts);
                });
              }
            }
          }
        }
      }
    },

    createControlButton: (cellId) => {
      console.log('createControlButton at cellId:',cellId);
      utils.refreshCellMaps();
      const cellIndex = utils.findCellIndexByCellId(cellId);
      const cells = Jupyter.notebook.get_cells();
      let nextCell;
      if (cellIndex === cells.length - 1) {
        // We are on last cell, so we need to add a markdown cell below for the button
        nextCell = Jupyter.notebook.insert_cell_at_bottom('markdown');
      } else {
        // Check the very next cell. if it is a markdown cell, just add the button to its contents. If not, insert a markdown cell before the next cell.
        const nextCellIndex = cellIndex + 1;
        nextCell = Jupyter.notebook.get_cell(nextCellIndex);
        // Make sure the next cell is a markdown cell, where we can insert a button. If it's a code cell, then we need to put a markdown cell above it.
        if (nextCell.cell_type === 'code') {
          nextCell = Jupyter.notebook.insert_cell_above('markdown', nextCellIndex);
        }
      }
      const cellContents = nextCell.get_text();
      const newButtonId = utils.generateUniqueId();
      const rawButtonMarkdown = '<button class="terminal-button-' + newButtonId + '">Button</button>';
      const newCellContents = rawButtonMarkdown + cellContents;
      const newCellId = utils.assignCellId(nextCell);
      nextCell.set_text(newCellContents);
      nextCell.render();
      let nextCellTerminalConfig = utils.getCellTerminalConfig(nextCell);
      let buttonsConfig;
      if (nextCellTerminalConfig === undefined) {
        nextCellTerminalConfig = {
          type: 'markdown',
          buttonsConfig: {}
        };
      }
      nextCellTerminalConfig.buttonsConfig[newButtonId] = {
        targetCellId: cellId,
        command: terminals.defaultButtonCommand,
        addCr: "true" };
      utils.assignCellTerminalConfig(nextCell, nextCellTerminalConfig);

      utils.refreshCellMaps();
      terminals.bindAllControlButtons();
    },

    createTerminalCell: (cellId, config) => {
      if (terminals.terminalsList.hasOwnProperty(cellId)) {
        return terminals.terminalsList[cellId]; // already have this terminal set up
      }
      const cell = utils.findCellByCellId(cellId);
      if (cell !== undefined) {
        const cellJq = $(cell.element);
        const renderArea = cellJq.find('.rendered_html');

        renderArea.html('<div>' +
                        '  <span id="dummy-screen-rows" style="font-family:courier; font-weight:bold; font-size:15px;">bash-3.2$ </span>' +
                        '</div>');
        const lineHeight = renderArea.find('#dummy-screen-rows').height();
        renderArea.html('Loading...' + localizer.getString('EXPLAIN_NON_LOAD'));

        const terminalHeight = lineHeight * config.rows; // pixels
        const terminalContainerId = 'terminal-container-' + cellId;

        renderArea.html('<div class="terminal-container" id="' + terminalContainerId + '" class="container" style="width:100%;height:' + terminalHeight + 'px;"></div>' +
                        '<div class="terminal-links">' +
                           (terminals.createMode ?
                            ' <div class="terminal-button-create">' + localizer.getString('CREATE_CONTROL_BUTTON') + '</div>' :
                            '') +
                        ' <div class="terminal-go-notebook-dir">' + localizer.getString('JUMP_TO_NOTEBOOK_DIR') + '</div>' +
                        ' <div class="terminal-reset">' + localizer.getString('RESET_TERMINAL') + '</div>' +
                        '</div>').show();

        const urlPathName = location.pathname;
        let host = location.host;
        let path = '/terminals/websocket/';
        if (urlPathName.indexOf('/notebooks/') > 0) {
          // In cases where Jupyter is hosted on a path-based VM, like on binder.org, we need to extract that path part
          // and put it in front of the regular terminals endpoint.
          const parts = urlPathName.split(/\/notebooks\//,2);
          path = (parts[0].length > 0 ? parts[0] + path : path);
        }
        const wsUrl = location.protocol.replace('http', 'ws') + '//' + location.host + path + config.terminalId;
        const elem = $('#' + terminalContainerId);
        const sizeObj = {cols:40, rows:10};
        renderArea.find('.terminal-reset').click((e) => {
          const target = $(e.target);
          const cellDOM = target.parents('.cell');
          const cellId = cellDOM.attr('terminal-cell-id');
          terminals.resetTerminalCell(cellId);
        });

        if (terminals.createMode) {
          renderArea.find('.terminal-button-create').click((e) => {
            const target = $(e.target);
            const cellDOM = target.parents('.cell');
            const cellId = cellDOM.attr('terminal-cell-id');
            terminals.createControlButton(cellId);
          });
        }

        renderArea.find('.terminal-container').bind('mousewheel', (e) => {
          //console.log('xterm mousewheel',e.originalEvent.wheelDeltaY); // looks like values about 10 move one line...
        });

        const newTerminal = terminals._makeTerminal(elem[0], cellId, wsUrl, sizeObj);
        terminals.terminalsList[cellId] = newTerminal;

        elem.bind('click', () => { newTerminal.term.focus(); });

        if (terminals.discoveredPwd !== undefined) {
          // in theory we could check to see if we're already in the directory we are supposed to be in using basename:
          // https://stackoverflow.com/questions/23162299/how-to-get-the-last-part-of-dirname-in-bash
          const cdCommand = "" + 'if test -d ' + terminals.discoveredPwd + '; then cd ' + terminals.discoveredPwd + "; fi" +
                            "&& clear\n";
          let fullCommand = cdCommand;
          if ((config.initialCommand !== undefined) && (config.initialCommand.length > 0)) {
            fullCommand += config.initialCommand + "\n";
          }
          if (!terminals.singleInitialCommand || (terminals.singleInitialCommand && terminals.initialCommandCount < 1)) {
            newTerminal.send(fullCommand);
            terminals.initialCommandCount++;
          }
          let resetCdCommand = cdCommand;
          renderArea.find('.terminal-go-notebook-dir').click((e) => {
            if (terminals.discoveredPwd !== undefined) {
              resetCdCommand = "" + 'cd ' + terminals.discoveredPwd + "&& clear\n";
            }
            newTerminal.send(resetCdCommand);
          });
        } else {
          renderArea.find('.terminal-go-notebook-dir').hide(); // if this link is inactive, just hide it.
        }

        return newTerminal;
      } else {
        return undefined;
      }
    },

    createTerminalInCell: (cell, terminalId, desiredRows, initialCommand) => {
      utils.assignCellId(cell); // make sure a new cell has a terminal cell id.
      utils.refreshCellMaps();
      const cellId = utils.getMetadataCellId(cell.metadata);
      if (terminalId === undefined) {
        terminalId = cellId;
      }
      if (cellId !== undefined) {
        const notebookDirectory = utils.getNotebookDirectory();
        const rows = (desiredRows === undefined ? 6 : desiredRows); // default is 6 rows but can be changed by metadata
        const terminalConfig = {
          type : 'terminal',
          terminalId: terminalId, // defaults to the terminal cell id, but can be changed if author wants to display the same terminal twice in one notebook.
          startingDirectory: notebookDirectory,
          initialCommand: initialCommand,
          rows: rows,
        };
        utils.assignCellTerminalConfig(cell, terminalConfig);
        utils.selectCellByCellId(cellId);
        cell.set_text('<i>Loading terminal (' + cellId + '), please wait... ' + localizer.getString('EXPLAIN_NON_LOAD'));
        cell.render();
        return terminals.createTerminalCell(cellId, terminalConfig);
      }
    },

    refreshTerminalCell: (cellId) => {
      if (terminals.terminalsList[cellId] !== undefined) {
        // Create a new terminal id so we'll connect to a fresh socket.
        const term = terminals.terminalsList[cellId].term;
        term.refresh(0,100000);
        term.focus();
      }
    },

    resetTerminalCell: (cellId) => {
      if (terminals.terminalsList[cellId] !== undefined) {
        const fetchParams = { method: 'delete', credentials: 'include',  };
        const cell = utils.findCellByCellId(cellId);
        const terminalConfig = utils.getCellTerminalConfig(cell);
        let terminalInitialCommand = terminals.defaultTerminalInitialCommand;
        if (terminalConfig !== undefined) {
          const deleteAPIEndpoint = location.origin + '/api/terminals/' + terminalConfig.terminalId;
          terminalInitialCommand = terminalConfig.initialCommand;
          const settings = {
            // liberally cribbed from jupyter's codebase,
            // https://github.com/jupyter/notebook/blob/b8b66332e2023e83d2ee04f83d8814f567e01a4e/notebook/static/tree/js/terminallist.js#L110
            processData : false,
            type : "DELETE",
            dataType : "json",
            success : function () {
              console.log('Terminals: successful terminal delete.');
            },
            error : utils.log_ajax_error,
          };
          jupyterUtils.ajax(deleteAPIEndpoint, settings);
        }
        const currentRows = terminals.terminalsList[cellId].term.rows;
        const currentInitialCommand = terminals.terminalsList[cellId].term.initialCommand;
        delete(terminals.terminalsList[cellId]);
        terminals.createTerminalInCell(cell, utils.generateUniqueId(), currentRows, terminalInitialCommand );
        utils.saveNotebookDebounced();
      }
    },

    // Just remove the cellId from the list we keep of terminals in the nb.
    removeTerminal: (cellId) => {
      delete(terminals.terminalsList[cellId]);
    },

    createTerminalCellBelowSelectedCell: () => {
      const newTerminalCell = Jupyter.notebook.insert_cell_below('markdown');
      if (newTerminalCell !== undefined) {
        return terminals.createTerminalInCell(newTerminalCell, utils.generateUniqueId(), terminals.defaultTerminalRows, terminals.defaultTerminalInitialCommand );
      }
      return undefined;
    },

    processRenderQueue: () => {
      if (terminals.renderQueue.length > 0) {
        const rq = terminals.renderQueue.shift();
        const cellId = utils.getMetadataCellId(rq.cell.metadata);
        // console.log('Terminals: Processing render queue entry, cellId:', cellId, "rq:", rq);
        terminals.createTerminalCell(cellId, rq.config);
        // make sure you can't double click this cell because that would break the terminal
        $(rq.cell.element[0]).unbind('dblclick').bind('dblclick', ((e) => {
          e.stopPropagation();
          return false;
        }));
        setTimeout(terminals.processRenderQueue, 250);
      }
    },

    renderOneTerminal: (cell) => {
      if (cell.cell_type === 'markdown') {
        if (cell.metadata.hasOwnProperty('terminalConfig')) {
          let config = $.extend({}, cell.metadata.terminalConfig);
          if (config.type === 'terminal') {
            if ((utils.getNotebookTerminalsConfigEntry('singleTerminal') !== undefined) &&
                (utils.getNotebookTerminalsConfigEntry('singleTerminal') == "true")) { // note that the metadata entry has to be "true", not just true. (double quotes req'd)
              config.terminalId = utils.getNotebookTerminalsConfigEntry('id');
              terminals.singleCDCommand = true;
            }
            terminals.renderQueue.push({cell: cell, config: config });
          }
        }
      }
    },

    // If there are terminals present in this notebook, render them.
    renderAllTerminals: () => {
      utils.refreshCellMaps();
      const cells = Jupyter.notebook.get_cells();
      let cell, cellId;
      terminals.renderQueue = [];
      for (let i = 0; i < cells.length; ++i) {
        cell = cells[i];
        terminals.renderOneTerminal(cell);
      }
      terminals.processRenderQueue();
    },

    focusTerminal: (cellId) => {
      const termRecord = terminals.terminalsList[cellId];
      if (termRecord !== undefined) {
        const cell = utils.findCellByCellId(cellId);
        cell.focus_cell();
        terminals.focusedTerminal = cellId;
        termRecord.term.focus();
      }
    },

    scrollTerminal: (opts) => {
      const termRecord = terminals.terminalsList[opts.id];
      if (termRecord !== undefined) {
        const term = termRecord.term;
        // Basically the same functionality as in scrollToLine, see here:
        // https://github.com/xtermjs/xterm.js/blob/c908da351b11d718f8dcda7424baee4bd8211681/src/Terminal.ts#L1302
        const scrollAmount = opts.scrollLine - term._core.buffer.ydisp;
        //console.log('scrollTerminal: opts.scrollLine', opts.scrollLine, 'ydisp', term._core.buffer.ydisp, 'scrollAmount', scrollAmount);
        if (scrollAmount !== 0) {
          term.scrollLines(scrollAmount);
          return true;
        }
      }
      return false;
    },

    getTerminalContents: (terminalId) => {
      const terminal = terminals.terminalsList[terminalId];
      return terminal.contents;
    },


    getTerminalsContents: () => {
      const contents = {};
      let terminal;
      for (let cellId of Object.keys(terminals.terminalsList)) {
        terminal = terminals.terminalsList[cellId];
        contents[cellId] = terminal.contents;
      }
      return contents;
    },

    refitOneTerminal: (terminal, cellId) => {
      const refitTerminal = (tryNumber) => {
        console.log('Terminals: Attempting to fit terminal:', cellId, ', attempt number', tryNumber);
        terminal.term.fit();
        terminal.socket.send(JSON.stringify(["set_size", terminal.term.rows, terminal.term.cols,
                                             window.innerHeight, window.innerWidth]));
        console.log('Terminals: fit terminal succeeded for:', cellId);
      };
      console.log('Terminals: Running fit on term', terminal.term.rows, terminal.term.cols);
      let refitAttempts = 0;
      const refitInterval = setInterval(() => {
        try {
          ++refitAttempts;
          refitTerminal(refitAttempts);
          clearInterval(refitInterval);
        } catch (ex) {
          if (refitAttempts > terminals.maxRefitAttempts) {
            console.log('Terminals: unable to call fit() after', refitAttempts, 'tries, giving up.');
            clearInterval(refitInterval);
          } else {
            console.log('Terminals: unable to call fit(), trying again in', terminals.fitRetryTime, 'seconds.');
          }
        }
      }, terminals.fitRetryTime);
    },

    refitAllTerminals: () => {
      let terminal;
      let term;
      for (let cellId of Object.keys(terminals.terminalsList)) {
        terminal = terminals.terminalsList[cellId];
        term = terminal.term;
        terminals.refitOneTerminal(terminal, cellId);
      }
    },

    isTerminalCell: (cellId) => {
      return (terminals.terminalsList[cellId] !== undefined);
    },

    runTerminalCommand: (terminalId, command, addCR) => {
      // Inject the terminal command into the target terminal (if found).
      if (terminals.terminalsList[terminalId] !== undefined) {
        const term = terminals.terminalsList[terminalId];
        term.send(command);
        if (addCR) {
          term.send("\n");
        }
      }
    },

    handleKeydown: (e) => {
      if (terminals.getFocusedTerminal() !== undefined) {
        // Let any focused terminal handle this event. Don't let jupyter (or anybody else) get it.
        e.stopPropagation();
        return true;
      }
    },

    setupTerminalInsertButton: () => {
      const notebook = Jupyter.notebook;
      const terminalHtml = terminals.renderTerminalHtml({width:20});
      const buttonContents = '<div id="terminal-insert-button" class="btn-group"><button class="btn btn-default" title="' +
                             localizer.getString('INSERT_TERMINAL') + '">';
      const setupButtonDiv = $(buttonContents + '<span>' + terminalHtml + '</div></button></span>');
      const jupyterMainToolbar = $('#maintoolbar-container');
      setupButtonDiv.appendTo(jupyterMainToolbar);
      setupButtonDiv.click(() => {
        console.log('Terminals: Creating terminal cell.');
        terminals.createTerminalCellBelowSelectedCell();
      });
    },

    setupKeyboardHandlers: () => {
      $('body').keydown((e) => {
        return terminals.handleKeydown(e);
      });
    },

    init: (eventsCallback) => {
      localizer.init();

      utils.loadCss([
        '/nbextensions/jupyterterminals/css/terminals.css',
        '/nbextensions/jupyterterminals/css/xterm.css'
      ]);

      terminals.setupTerminalInsertButton();
      terminals.setupKeyboardHandlers();
      terminals.discoverPwd();
      terminals.createMode = true; // to be controlled by notebook metadata shortly
      terminals.eventsCallback = eventsCallback;

      console.log('Terminals: initialized.');
    }

  }

  return terminals;

});
