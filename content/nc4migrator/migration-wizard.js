"use strict";

(function (exports) {
  const Cc = Components.classes;
  const Ci = Components.interfaces;
  const Cu = Components.utils;
  const Cr = Components.results;

  const { Util } = Cu.import("resource://nc4migrator-modules/Util.js", {});
  const { MigrationManager } = Cu.import('resource://nc4migrator-modules/MigrationManager.js', {});
  const { Services } = Cu.import("resource://nc4migrator-modules/Services.js", {});
  const { StringBundle } = Cu.import("resource://nc4migrator-modules/StringBundle.js", {});
  const { Deferred } = Cu.import('resource://nc4migrator-modules/jsdeferred.js', {});

  function $(id) document.getElementById(id);
  var createElement = Util.getElementCreator(document);

  var elements = {
    get wizard() $("nc4migrator-wizard"),

    get profileListPage() $("profile-list-page"),
    get migrationProfileList() $("migration-profile-list"),

    get confirmPage() $("confirm-page"),
    get migrationProfile() $("migration-profile"),
    get migrationAccount() $("migration-account"),
    get migrationQuotaDeck() $("migration-quota"),
    get migrationQuotaDetermined() $("migration-quota-determined"),
    get migrationQuotaDeterminedOver() $("migration-quota-determined-over"),
    get migrationEstimatedMigrationTime() $("migration-estimated-migration-time"),
    get migrationProgressMeter() $("migration-progress-meter"),

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
      let prompts = Cc["@mozilla.org/embedcomp/prompt-service;1"]
            .getService(Ci.nsIPromptService);

      const BUTTON_CONTINUE = 0;
      const BUTTON_EXIT     = 1;

      let flags = prompts.BUTTON_POS_0 * prompts.BUTTON_TITLE_IS_STRING +
            prompts.BUTTON_POS_1 * prompts.BUTTON_TITLE_IS_STRING;

      let button = prompts.confirmEx(
        null,
        StringBundle.nc4migrator.GetStringFromName("nextMigration_title"),
        StringBundle.nc4migrator.GetStringFromName("nextMigration_message"),
        flags,
        StringBundle.nc4migrator.GetStringFromName("nextMigration_continue"),
        StringBundle.nc4migrator.GetStringFromName("nextMigration_exit"),
        null,
        null, {}
      );

      switch (button) {
      case BUTTON_CONTINUE:
        setTimeout(function () {
          MigrationManager.beginWizard();
        }, 100);
        elements.wizard.calcel();
        break;
      case BUTTON_EXIT:
        this.confirmToRestart();
        elements.wizard.cancel();
        break;
      }

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
      elements.wizard.canAdvance = false;
      this.setProfile(this.getSelectedProfile())
        .next(function() {
          elements.wizard.canAdvance = true;
        });
    },

    onMigratingPageShow: function () {
      elements.migratingProfile.value = elements.migrationProfile.value;
      elements.migratingAccount.value = elements.migrationAccount.value;

      let { wizard } = elements;

      wizard.canAdvance = false;
      wizard.canRewind  = false;

      if (!this.currentMigrator)
        return Util.alert("Error", "Something wrong with this wizard", window);

      this.currentMigrator
        .migrate(function onProgress(progress) {
          let percentage = Math.min(100, parseInt(progress * 100));
          elements.migrationProgressMeter.value = percentage;
        })
        .next(function () {
          wizard.canAdvance = true;
          wizard.canRewind  = true;
          wizard.advance(null); // proceed next page
        })
        .error(function (x) {
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

        if (ncProfile.migrated)
          prettyName = StringBundle.nc4migrator.formatStringFromID("migratedProfileName", [prettyName], 1);

        var item = elements.migrationProfileList.appendItem(
          prettyName, name
        );
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
      if (!ncProfile) {
        return Deferred.next(function() {
        });
      }

      let migrator
            = this.currentMigrator
            = MigrationManager.getMigratorForNcProfile(ncProfile);

      elements.migrationProfile.value = ncProfile.name;
      elements.migrationAccount.value = ncProfile.mailAddress;

      return migrator.getLocalMailFolderQuota()
              .next(function(aResult) {
                let deck = elements.migrationQuotaDeck;
                if (aResult.complete) {
                  elements.migrationQuotaDetermined.value = Util.formatBytes(aResult.size);
                  deck.selectedIndex = 1;
                } else {
                  elements.migrationQuotaDeterminedOver.value = Util.formatBytes(aResult.size);
                  deck.selectedIndex = 2;
                }
              });
    },

    confirmToRestart: function () {
      let prompts = Cc["@mozilla.org/embedcomp/prompt-service;1"]
            .getService(Ci.nsIPromptService);

      const BUTTON_RESTART = 0;
      const BUTTON_STAY    = 1;

      let flags = prompts.BUTTON_POS_0 * prompts.BUTTON_TITLE_IS_STRING +
            prompts.BUTTON_POS_1 * prompts.BUTTON_TITLE_IS_STRING;

      let button = prompts.confirmEx(
        null,
        StringBundle.nc4migrator.GetStringFromName("restartConfirmation_title"),
        StringBundle.nc4migrator.GetStringFromName("restartConfirmation_message"),
        flags,
        StringBundle.nc4migrator.GetStringFromName("restartConfirmation_restart"),
        StringBundle.nc4migrator.GetStringFromName("restartConfirmation_stay"),
        null,
        null, {}
      );

      switch (button) {
      case BUTTON_RESTART:
        Util.restartApplication();
        break;
      case BUTTON_STAY:
        break;
      }
    },

    currentMigrator: null
  };

  exports.Wizard = Wizard;
})(window);
