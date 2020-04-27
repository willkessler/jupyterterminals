// Mark Graffiti as about to load, because extension should always get precedence over python API library
// in case that is also going to be loaded by Jupyter.

window.Terminals = null; 

define([], () => {
  return {
    load_ipython_extension: () => {
      require(['js/initExtension.js']);
    }
  };
});
