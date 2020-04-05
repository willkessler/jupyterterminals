define([
  'components/marked/lib/marked'
], function (marked) {

  const utils = {
    cellMaps: {},
    saveNotebookCallbacks: [],
    saveDebounceTiming: 1000, // Must be slower than 500ms, which is the speed at which jupyter traps save calls stepping on each other. See: 
                              // https://github.com/jupyter/notebook/blob/859ae0ac60456c0e38b44f06852b8a24f8a1cfb0/notebook/static/notebook/js/notebook.js#L2766
    cplusplusKernel11: 'xeus-cling-cpp11',
    cplusplusKernel14: 'xeus-cling-cpp14',
    cplusplusKernel17: 'xeus-cling-cpp17',
    pythonKernel: 'python3',
    rKernel: 'ir',

    addCR: (str) => {
      return str + "\n";
    },

    // This gets the relative path of the notebook from the server root. However, this is deprecated in favor of terminals.discoverPwd for
    // finding the full path of the current notebook.
    getNotebookDirectory: () => {
      const fullNotebookPath = Jupyter.notebook.notebook_path;
      let notebookPath, notebookPathParts;
      if (fullNotebookPath.indexOf('/') === -1) {
        notebookPath = fullNotebookPath;
        if (notebookPath.indexOf('.ipynb') !== -1) {
          notebookPath = undefined; // at the top level, we don't set a CD command
        }
      } else {
        notebookPathParts = fullNotebookPath.split('/');
        notebookPath = notebookPathParts.slice(0,notebookPathParts.length - 1).join('/');
      }
      return notebookPath;
    },

    rerenderMarkdownCell: (cell) => {
      setTimeout(() => {
        cell.unrender();
        cell.render();
      },1); // needing to do this, is really weird. if you don't call this on a timeout, jupyter does not rerender the cell.
    },

    generateUniqueId: () => {
      return 'id_' + Math.random().toString(36).substr(2, 7);
    },

    getNow: () => {
      return new Date().getTime();
    },

    createPermanentStringFromFlag: (flag) => {
      return flag ? 'permanent': 'temporary';
    },

    getCodeCommentString: () => {
      const currentKernelName = Jupyter.notebook.kernel.name;
      let codeCommentString;
      switch (currentKernelName) {
        case utils.cplusplusKernel11:
        case utils.cplusplusKernel14:
        case utils.cplusplusKernel17:
          codeCommentString = '//';
          break;
        case utils.pythonKernel:
        case utils.rKernel:
          codeCommentString = '#';
          break;
      }
      return codeCommentString;
    },

    // These two functions help us translate between what we store in the notebook json itself ('terminalCellId') and how we use it in the code, just as 'cellId'.
    // This was done to make our tags less likely to collide with other Jupyter plugins, but we wanted to keep the field name short in the Terminals code.
    getMetadataCellId: (metadata) => {
      return metadata.terminalCellId;
    },

    setMetadataCellId: (metadata, cellId) => {
      metadata.terminalCellId = cellId;
      return cellId;
    },

    parseRecordingFullId: (recordingFullId) => {
      const parts = recordingFullId.split('_');
      const recordingCellId = 'id_' + parts[0];
      const recordingKey = 'id_' + parts[1];
      return {
        recordingCellId: recordingCellId,
        recordingKey: recordingKey
      };
    },

    computeArrayAverage: (array) => {
      let average = 0;
      for (let i = 0; i < array.length;++i) {
        average += array[i];
      }
      average = average / array.length;
      return average;      
    },

    subtractCoords: (c1, c2) => {
      const x1 = (c1.x !== undefined ? c1.x : c1.left);
      const y1 = (c1.y !== undefined ? c1.y : c1.top);
      const x2 = (c2.x !== undefined ? c2.x : c2.left);
      const y2 = (c2.y !== undefined ? c2.y : c2.top);
      return { 
        x: x2 - x1, 
        y: y2 - y1
      }
    },

    clearSelectedCellOutput: () => {
      const selectedCell = Jupyter.notebook.get_selected_cell();
      if (selectedCell !== undefined) {
        selectedCell.clear_output();
      }
    },

    composeTerminalId: (cellId, recordingKey, activeTakeId) => {
      const combinedIds = [cellId.replace('id_',''),recordingKey.replace('id_','')];
      if (activeTakeId !== undefined) {
        combinedIds.push(activeTakeId.replace('id_',''));
      }
      const combinedIdStr = combinedIds.join('_');
      return combinedIdStr;
    },

    // Assign terminal cellIds to any cells that doesn't have one.
    assignCellId: (cell) => {
      if (!cell.metadata.hasOwnProperty('terminalCellId')) {
        const cellId = utils.generateUniqueId();
        return utils.setMetadataCellId(cell.metadata, cellId);
      }
      return utils.getMetadataCellId(cell.metadata);
    },

    assignCellTerminalConfig: (cell, terminalConfig) => {
      cell.metadata['terminalConfig'] = terminalConfig;
    },

    setCellTerminalConfigEntry: (cell, key, val) => {
      if (!cell.metadata.hasOwnProperty('terminalConfig')) {
        cell.metadata['terminalConfig'] = {};
      }
      cell.metadata.terminalConfig[key] = val;
    },

    getCellTerminalConfig: (cell) => {
      if (cell.metadata.hasOwnProperty('terminalConfig')) {
        return cell.metadata['terminalConfig'];
      }
      return undefined;
    },

    getCellTerminalsConfigEntry: (cell, key) => {
      if (cell.metadata.hasOwnProperty('terminalConfig')) {
        if (cell.metadata.terminalConfig.hasOwnProperty(key)) {
          return cell.metadata.terminalConfig[key];
        }
      }
      return undefined;
    },

    getNotebookTerminalsConfigEntry: (key) => {
      if (Jupyter.notebook.metadata.hasOwnProperty('terminals')) {
        return Jupyter.notebook.metadata['terminals'][key];
      }
      return undefined;
    },

    setNotebookTerminalConfigEntry: (key, val) => {
      if (Jupyter.notebook.metadata.hasOwnProperty('terminals')) {
        Jupyter.notebook.metadata['terminals'][key] = val;
      }
    },

    refreshCellMaps: () => {
      utils.cellMaps = {
        cells: Jupyter.notebook.get_cells(),
        maps: {}
      }
      let cell, cellId, cellDOM, cellKeys = Object.keys(utils.cellMaps.cells);
      for (let cellIndex = 0; cellIndex < cellKeys.length; ++cellIndex) {
        cell = utils.cellMaps.cells[cellIndex];
        cellId = utils.getMetadataCellId(cell.metadata);
        // Support lookups by cellId only for jupyterterminals. 
        // (Graffiti, by contrast, needs to look things up in many more ways.)
        utils.cellMaps.maps[cellId] = cellIndex;
        // Support lookups by cellId.
        utils.cellMaps.maps[cellId] = cellIndex;
        // Dress up the DOM with a cellId so we can reset terminals
        if (cell.hasOwnProperty('inner_cell')) {
          cellDOM = $(cell.inner_cell).parents('.cell');
        } else if (cell.hasOwnProperty('element')) {
          cellDOM = $(cell.element);
        }
        if (cellDOM !== undefined) {
          cellDOM.attr({ 'terminal-cell-id' : utils.getMetadataCellId(cell.metadata)});
        }
      }
    },

    findCellIndexByCellId: (cellId) => {
      if (utils.cellMaps !== undefined && utils.cellMaps.maps !== undefined && utils.cellMaps.maps.hasOwnProperty(cellId)) {
        return utils.cellMaps.maps[cellId];
      }
      return undefined;
    },

    findCellByCellId: (cellId) => {
      const index = utils.findCellIndexByCellId(cellId);
      if (index !== undefined) {
        return utils.cellMaps.cells[index];
      }
      return undefined;
    },


    selectCellByCellId: (cellId) => {
      const cellIndex = utils.findCellIndexByCellId(cellId);
      if (cellIndex !== undefined) {
        Jupyter.notebook.select(cellIndex);
      }
    },

    getCellRects: (cell) => {
      const cellElement = $(cell.element[0]);
      const cellRect = cellElement[0].getBoundingClientRect();
      const innerCell = cellElement.find('.inner_cell')[0];
      const innerCellRect = innerCell.getBoundingClientRect();
      const prompt = cellElement.find('.prompt')[0];
      const promptRect = prompt.getBoundingClientRect();

      return {
        cellRect: cellRect,
        innerCell: innerCell,
        innerCellRect: innerCellRect,
        promptRect:promptRect
      }
    },

    renderMarkdown: (contents) => {
      // Strip out special commands eg. headline commands and make all hrefs pop new tabs
      const cleanedContents = contents.replace(/^\s*%%(.*)$/mg, '');
      return marked(cleanedContents).replace(/(href=".*")>/g, "$1 target=\"_blank\">");
    },

    collectViewInfo: (clientX, clientY, notebookPanelHeight, scrollDiff) => {
      let cellElement, cellElementJq, cellRect, outerCellRect,
          cellIndex, cellIndexStr, cell, innerCell, innerCellRect, innerCellRectRaw, prompt, 
          pointerPosition, pointerInsidePromptArea, cellPosition, lineNumbersVisible, cm;
      const inputCells = Jupyter.notebook.get_cells();
      const selectedCell = Jupyter.notebook.get_selected_cell();
      const selectedCellId = utils.getMetadataCellId(selectedCell.metadata);
      // handle case where pointer is above all cells or below all cells
      let promptBbox = undefined;
      for (cellIndexStr in inputCells) {
        cellIndex = parseInt(cellIndexStr);
        cell = inputCells[cellIndex];
        cellElement = cell.element[0];
        cellElementJq = $(cellElement);
        cellRect = cellElement.getBoundingClientRect();
        prompt = cellElementJq.find('.prompt');
        pointerInsidePromptArea = false;
        if ((prompt.length > 0) && (prompt.is(':visible'))) {
          promptBbox = prompt[0].getBoundingClientRect();
          pointerInsidePromptArea = ((clientX >= promptBbox.left) && (clientX < promptBbox.right) &&
                                     (clientY >= promptBbox.top)  && (clientY < promptBbox.bottom));
        }
        if ( ((cellRect.top <= clientY) && (clientY <= cellRect.bottom)) ||
             // These are the cases where the pointer is above the first cell or below the last cell
             (((cellIndex === 0) && (clientY < cellRect.top)) ||
              ((cellIndex === inputCells.length - 1) && (cellRect.bottom < clientY))) ) {
          outerCellRect = {
            top: cellRect.top,
            left: cellRect.left
          };
          innerCell = cellElementJq.find('.inner_cell')[0];
          innerCellRectRaw = innerCell.getBoundingClientRect();
          innerCellRect = { 
            top: innerCellRectRaw.top, 
            left: innerCellRectRaw.left, 
            width: innerCellRectRaw.width, 
            height: innerCellRectRaw.height 
          };
          lineNumbersVisible = cell.code_mirror.options.lineNumbers;
          cellPosition = cellElementJq.position();
          cm = cell.code_mirror;
          const innerScrollInfo = cm.getScrollInfo();
          const innerScroll = { left: innerScrollInfo.left, top: innerScrollInfo.top };
          return {
            cellId: utils.getMetadataCellId(cell.metadata), // The id of cell that the pointer is hovering over right now
            cellIndex: cellIndex,
            innerCellRect: innerCellRect,
            innerScroll: innerScroll,
            lineNumbersVisible: lineNumbersVisible,
            outerCellRect: outerCellRect,
            inMarkdownCell: (cell.cell_type === 'markdown'),
            inPromptArea: pointerInsidePromptArea,
            promptWidth: (promptBbox === undefined ? 0 : promptBbox.width),
            selectedCellId: selectedCellId,
            notebookPanelHeight: notebookPanelHeight,
            scrollDiff: scrollDiff
          };
        }
      }
      return { cellId: undefined, cellRectTop: undefined, cellRectBottom: undefined, relativePointerPosition: undefined };

    },

    getActiveCellId: () => {
      const activeCell = Jupyter.notebook.get_selected_cell();
      return utils.getMetadataCellId(activeCell.metadata);
    },

    getActiveCellLineNumber: () => {
      const activeCell = Jupyter.notebook.get_selected_cell();
      const cm = activeCell.code_mirror;
      const selections = cm.listSelections();
      const activeLine = selections[0].anchor.line;
      return activeLine;
    },

    queueSaveNotebookCallback: (cb) => {
      utils.saveNotebookCallbacks.push(cb);
    },

    processSaveNotebookCallbacks: () => {
      let cb;
      while (utils.saveNotebookCallbacks.length > 0) {
        cb = utils.saveNotebookCallbacks.shift();
        cb();
      }
      console.log('Terminals: Notebook saved successfully.');
    },

    saveNotebook: () => {
      Jupyter.notebook.save_notebook().then(() => {
        utils.processSaveNotebookCallbacks();
      }).catch((ex) => {
        console.error('Terminals: saveNotebook caught exception:', ex);
      });
    },

    //
    // Time formatting functions
    //
    timeZeroPad: (num) => {
      const strNum = num.toString();
      return(strNum.length < 2 ? '0' + strNum : strNum);
    },

    formatTime: (currentTimeMilliseconds, opts) => {
      const currentTimeSeconds = currentTimeMilliseconds / 1000;
      const computedHour = Math.floor(currentTimeSeconds / 3600);
      const computedMinutes = Math.floor((currentTimeSeconds - (computedHour * 3600)) / 60);
      const computedSeconds = Math.floor(currentTimeSeconds - (computedMinutes * 60 + computedHour * 3600));
      const computedMilliseconds = Math.min(99, 
                                            (Math.floor(currentTimeMilliseconds -
                                                        ((computedSeconds + computedMinutes * 60 + computedHour * 3600) * 1000)) / 10).toFixed(0));
      let displayMilliseconds = utils.timeZeroPad(computedMilliseconds);
      let displaySeconds = utils.timeZeroPad(computedSeconds);
      let displayMinutes = utils.timeZeroPad(computedMinutes);
      let displayHour = utils.timeZeroPad(computedHour);
      let currentTimeFormatted;
      if (opts.includeMillis) {
        currentTimeFormatted = `${displayMinutes}:${displaySeconds}:${displayMilliseconds}`;
      } else {
        currentTimeFormatted = `${displayMinutes}:${displaySeconds}`;
      }
      return(currentTimeFormatted);
    },

    reworkFetchPathForVirtualHosts: (path) => {
      // Rework fetch paths on hosts like binder.org, where there is some additional virtual path between document.origin
      // and the path to the notebook. If a relative path, keep "notebook" in the path; otherwise start
      // any absolute path from *after* document.location.origin + virtual path.
      const loc = document.location;
      const urlPathName = loc.pathname;
      const hasNotebooks = (urlPathName.indexOf('/notebooks/') > -1);
      const leadingSlash = (path[0] === '/');
      let pathMiddle = '', parts;
      if (hasNotebooks) {
        pathMiddle = (leadingSlash ? '' : '/notebooks/');
        parts = urlPathName.split(/\/notebooks\//,2);
      }
      const reworkedPath = loc.origin + (parts[0].length > 0 ? parts[0] + pathMiddle + path : pathMiddle + path);
      return reworkedPath;
    },

    loadCss: (cssPaths) => {
      let path, reworkedPath, previousCssTag;
      for (let i in cssPaths) {
        path = cssPaths[i];
        reworkedPath = utils.reworkFetchPathForVirtualHosts(path);

        previousCssTag = $('#recorder-css-tag-' + i);
        if (previousCssTag.length === 0) {
          // https://stackoverflow.com/questions/18510347/dynamically-load-stylesheets
          const styles = document.createElement('link');
          styles.rel = 'stylesheet';
          styles.id = 'recorder-css-tag-' + i;
          styles.type = 'text/css';
          styles.media = 'screen';
          styles.href = reworkedPath;
          document.getElementsByTagName('head')[0].appendChild(styles);
        }
      }
    },

    // https://stackoverflow.com/a/18284182/2767287
    getViewportSize: (w) => {
      // Use the specified window or the current window if no argument
      w = w || window;

      // This works for all browsers except IE8 and before
      if (w.innerWidth != null) return { w: w.innerWidth, h: w.innerHeight };

      // For IE (or any browser) in Standards mode
      var d = w.document;
      if (document.compatMode == "CSS1Compat")
        return { w: d.documentElement.clientWidth,
                 h: d.documentElement.clientHeight };

      // For browsers in Quirks mode
      return { w: d.body.clientWidth, h: d.body.clientHeight };

    },

    // Thanks for this goes to : https://hackernoon.com/copying-text-to-clipboard-with-javascript-df4d4988697f
    copyToClipboard: (str) => {
      const el = document.createElement('textarea');  // Create a <textarea> element
      el.value = str;                                 // Set its value to the string that you want copied
      el.setAttribute('readonly', '');                // Make it readonly to be tamper-proof
      el.style.position = 'absolute';                 
      el.style.left = '-9999px';                      // Move outside the screen to make it invisible
      document.body.appendChild(el);                  // Append the <textarea> element to the HTML document
      const selected =            
        document.getSelection().rangeCount > 0        // Check if there is any content selected previously
        ? document.getSelection().getRangeAt(0)       // Store selection if found
        : false;                                      // Mark as false to know no selection existed before
      el.select();                                    // Select the <textarea> content
      document.execCommand('copy');                   // Copy - only works as a result of a user action (e.g. click events)
      document.body.removeChild(el);                  // Remove the <textarea> element
      if (selected) {                                 // If a selection existed before copying
        document.getSelection().removeAllRanges();    // Unselect everything on the HTML document
        document.getSelection().addRange(selected);   // Restore the original selection
      }
    },

    isUdacityEnvironment: () => {
      const host = location.hostname;
      if (host.endsWith('udacity.com') || 
          host.endsWith('udacity-student-workspaces.com')) {
        return true;
      }
      return false;
    },

    // Detect if operating system is Windows. This method will only work on notebooks with python kernels!
    onWindowsOS: () => {
      const platform = navigator.platform;
      if ((platform.indexOf('Win') === 0) ||
          (platform.indexOf('win') === 0)) {
        console.log('Terminals: Windows OS detected.');
        return true;
      }
      return false;
    }

  }

  utils.saveNotebookDebounced = _.debounce(utils.saveNotebook, utils.saveDebounceTiming, false);

  return(utils);
});



