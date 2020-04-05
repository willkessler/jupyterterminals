/*
  Used in api.py when importing terminals as python module.
  Notice that unlike main.js this doesn't return  "load_ipython_extension" call
*/

define([], () => {
  if (window.Terminals !== undefined) {
    console.log('Terminals already instantiated, not reinitializing');
    return;
  }
  require(['/nbextensions/jupyterterminals/js/initExtension.js']);
});
