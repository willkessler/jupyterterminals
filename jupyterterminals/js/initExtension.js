/*
   Used by main.js and loader.js 
 */

define([
  'base/js/namespace',
  '/nbextensions/jupyterterminals/js/terminals.js',
  '/nbextensions/jupyterterminals/js/utils.js',
], (Jupyter, Terminals, utils) => {
  console.log('JupyterTerminals loaded:', Terminals);

  // This ensures Jupyter.kernel.execute works
  const waitForKernelToBeReady = () => {
    window.Terminals = Terminals;
    
    if (Jupyter.notebook.kernel) {
      Terminals.init();
    } else {
      Jupyter.notebook.events.on('kernel_ready.Kernel', (e) => {
        console.log('Terminals: kernel ready, possible kernel restart.', e);
        console.log('Terminals: Reloading loader.js');
        require(['js/loader.js']);
      });
    }
  }

  // the notebook may have fully loaded before the nbextension gets loaded
  // so the nbextension would miss the `notebook_loaded.Notebook` event
  if (Jupyter.notebook._fully_loaded) {
    console.log('Terminals: Notebook is already fully loaded.');
    waitForKernelToBeReady();
  } else {
    Jupyter.notebook.events.on('notebook_loaded.Notebook', (e) => {
      console.log('Terminals: Notebook is loaded.');
      waitForKernelToBeReady();
    })
  } 
});
