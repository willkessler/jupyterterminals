define([
], function () {
  const localizer = {  
    defaultLanguage: 'EN',
    language: 'EN',

    getLanguage: () => {
      return localizer.language;
    },

    setLanguage: (language) => {
      if (language !== undefined) {
        localizer.language = language;
      } else {
        localizer.language = localizer.defaultLanguage;
      }
    },

    getString: (token) => {
      if (localizer.translations.hasOwnProperty(localizer.language)) {
        if (localizer.translations[localizer.language].hasOwnProperty(token)) {
          if (localizer.translations[localizer.language][token].length > 0) {
            // console.log('localized, for ' + token + ' returning ' , localizer.translations[localizer.language][token]);
            return localizer.translations[localizer.language][token];
          } else {
            // console.log('unlocalized, for ' + token + ' returning ' , localizer.translations[localizer.defaultLanguage][token]);
            return localizer.translations[localizer.defaultLanguage][token];
          }
        }
      }
      // Cant find the string, just return the token so it's obvious it needs translation
      return token;
    },

    loadLocale: (locale) => {
      switch (locale) {
        case 'EN':
          localizer.translations['EN'] = {
            'INSERT_TERMINAL':                   'Insert a Terminal',
            'RESET_TERMINAL':                    'Reset',
            'JUMP_TO_NOTEBOOK_DIR':              'Jump to Notebook\'s Dir',
            'CREATE_CONTROL_BUTTON':             'Create Control Button',
            'EXPLAIN_NON_LOAD':                  'If you do not see an interactive terminal here eventually, you may need to install the JupyterTerminals extension, see:' +
                                                 ' https://github.com/willkessler/jupyterterminals</i>',
          }
          break;
        case 'CN':
          // If anybody wants to help localize to Chinese here, i'd appreciate the help
          localizer.translations['CN'] = {          
            'INSERT_TERMINAL':                   'Insert a Terminal',
            'RESET_TERMINAL':                    'Reset',
            'JUMP_TO_NOTEBOOK_DIR':              'Jump to Notebook\'s Dir',
            'CREATE_CONTROL_BUTTON':             'Create Control Button',
            'EXPLAIN_NON_LOAD':                  'If you do not see an interactive terminal here eventually, you may need to install the JupyterTerminals extension, see:' +
                                                 ' https://github.com/willkessler/jupyterterminals</i>',
          };
          break;
      }
    },

    init: () => {
      localizer.translations = {};
      localizer.loadLocale('EN');
      localizer.loadLocale('CN');

      const notebook = Jupyter.notebook;
      localizer.setLanguage('EN');
      if (notebook.metadata.hasOwnProperty('graffiti')) {
        if (notebook.metadata.graffiti.hasOwnProperty('language')) {
          localizer.setLanguage(notebook.metadata.graffiti.language);
        }
      }

      return Promise.resolve();

    },

  };

  return (localizer);

});
