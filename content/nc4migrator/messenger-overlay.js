var Nc4Migrator = {
  beginMigration: function () {
    window.openDialog(
      "chrome://nc4migrator/content/migration-wizard.xul",
      "nc4migrator:migrationWizard",
      "chrome=yes,titlebar=yes,dialog=yes,modal=yes,resizable=yes"
    );
  }
};
