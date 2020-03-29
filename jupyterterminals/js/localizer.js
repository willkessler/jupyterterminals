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
            'ENABLE_TERMINALS':                  'Enable Terminals',
            'ACTIVATE_TERMINALS':                'Activate Terminals',
            'RESET_TERMINAL':                    'Reset',

          }
          break;
        case 'CN':
          localizer.translations['CN'] = {          
            'ENABLE_TERMINALS':                  '启用 Terminals',
            'ACTIVATE_TERMINALS':                '开始使用 Terminals ',
            'RESET_TERMINAL':                    'Reset',
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
