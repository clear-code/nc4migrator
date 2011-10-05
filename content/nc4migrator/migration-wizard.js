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
    get migrationQuota() $("migration-quota"),
    get migrationQuotaRow() $("migration-quota-row"),
    get migrationEstimatedTime() $("migration-estimated-time"),
    get migrationEstimatedTimeRow() $("migration-estimated-time-row"),
    get migrationQuotaAndEstimatedTimeUndetermined() $("migration-quota-and-estimated-time-undetermined"),
    get migrationQuotaAndEstimatedTimeRow() $("migration-quota-and-estimated-time-row"),


    get migratingProfile() $("migrating-profile"),
    get migratingAccount() $("migrating-account"),
    get migrationProgressMeter() $("migration-progress-meter"),

    get migrationResultMessage() $("migration-result-message")
  };

  var Wizard = {
    // ------------------------------------------------------------
    // Event Handlers
    // ------------------------------------------------------------

    onLoad: function () {
    },

    onFinish: function () {
      const BUTTON_CONTINUE = 0;
      const BUTTON_EXIT     = 1;
      let flags = Ci.nsIPromptService.BUTTON_POS_0 * Ci.nsIPromptService.BUTTON_TITLE_IS_STRING +
                  Ci.nsIPromptService.BUTTON_POS_1 * Ci.nsIPromptService.BUTTON_TITLE_IS_STRING;
      let button = Util.confirmEx(
        window,
        StringBundle.nc4migrator.GetStringFromName("nextMigration_title"),
        StringBundle.nc4migrator.GetStringFromName("nextMigration_message"),
        flags,
        StringBundle.nc4migrator.GetStringFromName("nextMigration_continue"),
        StringBundle.nc4migrator.GetStringFromName("nextMigration_exit"),
        null
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
      return this.canCancel;
    },

    onClose: function () {
      return this.canCancel;
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

      if (!this.currentMigrator) {
        let error = StringBundle.nc4migrator.GetStringFromName("migrationError_noMigrator");
        elements.migrationResultMessage.textContent = StringBundle.nc4migrator.formatStringFromName("migrationError", [error], 1);
        wizard.advance(null); // proceed next page
        return;
      }

      wizard.canAdvance = false;
      wizard.canRewind  = false;

      this.canCancel = false;

      let that = this;
      this.currentMigrator
        .migrate(function onProgress(progress) {
          let percentage = Math.min(100, parseInt(progress * 100));
          elements.migrationProgressMeter.value = percentage;
        })
        .next(function () {
          return StringBundle.nc4migrator.formatStringFromName("migrationSuccess", [elements.migrationProfile.value], 1);
        })
        .error(function (x) {
          return StringBundle.nc4migrator.formatStringFromName("migrationError", [x], 1);
        })
        .next(function (message) {
          elements.migrationResultMessage.textContent = message;

          wizard.canAdvance = true;
          wizard.canRewind  = true;
          wizard.advance(null); // proceed next page

          that.canCancel = true;
        });
    },

    onFinishPageShow: function () {
      elements.wizard.canRewind  = false; // never back
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
        var originalPrettyName = prettyName;

        var migrated = ncProfile.migrated;
        if (migrated)
          prettyName = StringBundle.nc4migrator.formatStringFromName("migratedProfileName", [prettyName], 1);

        var item = elements.migrationProfileList.appendItem(
          prettyName, name
        );
        item.setAttribute("name", originalPrettyName);
        if (migrated)
          item.setAttribute("migrated", true);
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
      let selectedItem = elements.migrationProfileList.selectedItem;

      if (!selectedItem) {
        Util.alert("Select a profile",
                   "Please select a profile",
                   window);
        return false;
      }

      if (selectedItem.getAttribute("migrated") == "true") {
        let BUTTON_CONTINUE = 0;
        let BUTTON_CANCEL   = 1;
        let flags = Ci.nsIPromptService.BUTTON_POS_0 * Ci.nsIPromptService.BUTTON_TITLE_IS_STRING +
                    Ci.nsIPromptService.BUTTON_POS_1 * Ci.nsIPromptService.BUTTON_TITLE_IS_STRING;
        let button = Util.confirmEx(
          window,
          StringBundle.nc4migrator.GetStringFromName("reimportConfirmation_title"),
          StringBundle.nc4migrator.formatStringFromName("reimportConfirmation_message", [selectedItem.getAttribute("name")], 1),
          flags,
          StringBundle.nc4migrator.GetStringFromName("reimportConfirmation_continue"),
          StringBundle.nc4migrator.GetStringFromName("reimportConfirmation_cancel"),
          null
        );
        if (button != BUTTON_CONTINUE)
          return false;
      }

      return true;
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

      let seconds = Math.round((migrator.quotaCalculationTimeout || 1) / 1000);
      elements.migrationQuotaAndEstimatedTimeUndetermined.value = StringBundle.nc4migrator.formatStringFromName("calculatingMigrationTime", [seconds], 1);

      elements.migrationQuotaRow.hidden = true;
      elements.migrationEstimatedTimeRow.hidden = true;
      elements.migrationQuotaAndEstimatedTimeRow.hidden = false;

      return migrator.getLocalMailFolderQuota()
              .next(function(aResult) {
                var quota = Util.formatBytes(aResult.size);
                var seconds = Math.round((aResult.size || 1) / 1024 / migrator.erapsedTimePer1MB);
                if (aResult.complete) {
                  elements.migrationQuota.value = quota;
                  elements.migrationEstimatedTime.value = seconds;
                } else {
                  elements.migrationQuota.value = StringBundle.nc4migrator.formatStringFromName("calculatedQuotaOver", [quota], 1);
                  elements.migrationEstimatedTime.value = StringBundle.nc4migrator.formatStringFromName("calculatedErapsedTimeOver", [seconds], 1);
                }
                elements.migrationQuotaRow.hidden = false;
                elements.migrationEstimatedTimeRow.hidden = false;
                elements.migrationQuotaAndEstimatedTimeRow.hidden = true;
              })
              .error(function(x) {
                Util.alert(x);
              });
    },

    confirmToRestart: function () {
      const BUTTON_RESTART = 0;
      const BUTTON_STAY    = 1;
      let flags = Ci.nsIPromptService.BUTTON_POS_0 * Ci.nsIPromptService.BUTTON_TITLE_IS_STRING +
                  Ci.nsIPromptService.BUTTON_POS_1 * Ci.nsIPromptService.BUTTON_TITLE_IS_STRING;
      let button = Util.confirmEx(
        window,
        StringBundle.nc4migrator.GetStringFromName("restartConfirmation_title"),
        StringBundle.nc4migrator.GetStringFromName("restartConfirmation_message"),
        flags,
        StringBundle.nc4migrator.GetStringFromName("restartConfirmation_restart"),
        StringBundle.nc4migrator.GetStringFromName("restartConfirmation_stay"),
        null
      );

      switch (button) {
      case BUTTON_RESTART:
        Util.restartApplication();
        break;
      case BUTTON_STAY:
        break;
      }
    },

    currentMigrator: null,


    get canCancel() {
      return !elements.wizard._cancelButton.disabled;
    },
    set canCancel(value) {
      elements.wizard._cancelButton.disabled = !value;
      return value;
    }
  };

  exports.Wizard = Wizard;
})(window);
