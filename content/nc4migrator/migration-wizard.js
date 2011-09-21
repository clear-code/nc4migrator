"use strict";

(function (exports) {
  const Cc = Components.classes;
  const Ci = Components.interfaces;
  const Cu = Components.utils;
  const Cr = Components.results;

  const { Util } = Cu.import("chrome://nc4migrator/content/modules/Util.js", {});
  const { MigrationManager } = Cu.import('chrome://nc4migrator/content/modules/MigrationManager.js', {});

  function $(id) document.getElementById(id);
  var createElement = Util.getElementCreator(document);

  var elements = {
    get wizard() $("nc4migrator-wizard"),

    get profileListPage() $("profile-list-page"),
    get migrationProfileList() $("migration-profile-list"),

    get confirmPage() $("confirm-page"),
    get migrationProfile() $("migration-profile"),
    get migrationAccount() $("migration-account"),
    get migrationQuota() $("migration-quota"),
    get migrationEstimatedMigrationTime() $("migration-estimated-migration-time"),

    get migratingProfile() $("migrating-profile"),
    get migratingAccount() $("migrating-account"),

    get migratedProfile() $("migrated-profile")
  };

  var Wizard = {
    // ------------------------------------------------------------
    // Event Handlers
    // ------------------------------------------------------------

    onLoad: function () {
    },

    onFinish: function () {
      return true;
    },

    onCancel: function () {
      return true;
    },

    profileListUpdated: false,
    onProfileListPageShow: function () {
      if (this.profileListUpdated)
        return;
      this.updateProfileList();
      this.profileListUpdated = true;
    },

    onConfirmationPageShow: function () {
      this.setProfile(this.getSelectedProfile());
    },

    onMigratingPageShow: function () {
      elements.migratingProfile.value = elements.migrationProfile.value;
      elements.migratingAccount.value = elements.migrationAccount.value;

      let { wizard } = elements;

      wizard.canAdvance = false;
      wizard.canRewind  = false;

      if (!this.currentMigrator)
        return Util.alert("Error", "Something wrong with this wizard", window);

      this.currentMigrator.migrate(function onMigrated() {
        wizard.canAdvance = true;
        wizard.canRewind  = true;
        wizard.advance(null); // proceed next page
      }, function onError(x) {
        Util.alert("Error", "Failed to migrate account: " + x, window);
      });
    },

    onFinishPageShow: function () {
      elements.wizard.canRewind  = false; // never back
      elements.migratedProfile.value = elements.migrationProfile.value;
    },

    // ------------------------------------------------------------
    // Functions
    // ------------------------------------------------------------

    get ncProfiles() {
      if (!this._ncProfiles)
        this._ncProfiles = MigrationManager.ncProfiles;
      return this._ncProfiles;
    },

    updateProfileList: function () {
      Util.DEBUG = true;

      this.ncProfiles.forEach(function (ncProfile, i) {
        var name = ncProfile.name;
        var prettyName = name + " <" + ncProfile.mailAddress + ">";

        var item = elements.migrationProfileList.appendItem(
          prettyName, name
        );

        item.disabled = ncProfile.isImported();
      });

      elements.migrationProfileList.selectedIndex = 0;
    },

    getSelectedProfile: function () {
      let selectedItem = elements.migrationProfileList.selectedItem;
      if (!selectedItem)
        return;

      let name = selectedItem.getAttribute("value");

      for (let [, profile] in Iterator(this.ncProfiles)) {
        if (profile.name === name)
          return profile;
      }

      return null;
    },

    ensureProfileSelected: function () {
      let profileSelected =  !!elements.migrationProfileList.selectedItem;

      if (!profileSelected) {
        Util.alert("Select a profile",
                   "Please select a profile",
                   window);
      }

      return profileSelected;
    },

    setProfile: function (ncProfile) {
      if (!ncProfile)
        return;

      let migrator
            = this.currentMigrator
            = MigrationManager.getMigratorForNcProfile(ncProfile);

      elements.migrationProfile.value = ncProfile.name;
      elements.migrationAccount.value = ncProfile.mailAddress;

      let quota = migrator.getLocalMailFolderQuota();
      elements.migrationQuota.value = Util.formatBytes(quota);
    },

    currentMigrator: null
  };

  exports.Wizard = Wizard;
})(window);
