"use strict";

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

(function (exports) {
  const Cc = Components.classes;
  const Ci = Components.interfaces;
  const Cu = Components.utils;
  const Cr = Components.results;

  const { Promise } = Components.utils.import('resource://gre/modules/Promise.jsm', {});

  const { Util } = Cu.import("resource://nc4migrator-modules/Util.js", {});
  const { MigrationManager } = Cu.import('resource://nc4migrator-modules/MigrationManager.js', {});
  const { Services } = Cu.import("resource://nc4migrator-modules/Services.js", {});
  const { StringBundle } = Cu.import("resource://nc4migrator-modules/StringBundle.js", {});

  const { Preferences } = Cu.import("resource://nc4migrator-modules/Preferences.js", {});
  const Prefs = new Preferences("");

  const Messages = {
    _messages : new Preferences("extensions.nc4migrator.wizard."),
    getLocalized: function (key, defaultValue) {
      if (this._messages.has(key + ".override"))
        key += ".override";
      return this._messages.getLocalized(key, defaultValue);
    }
  };

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

    get migratingPage() $("migrating-page"),
    get migratingProfile() $("migrating-profile"),
    get migratingAccount() $("migrating-account"),
    get migrationProgressMeter() $("migration-progress-meter"),
    get migrationProgressUndeterminedMeter() $("migration-progress-undetermined-meter"),

    get finishPage() $("finish-page"),
    get migrationResultMessage() document.querySelector("#finish-page description.wizard-page-message")
  };

  var Wizard = {
    // ------------------------------------------------------------
    // Event Handlers
    // ------------------------------------------------------------

    onLoad: function () {
      if (!this.ncProfiles.length) {
        Util.alert(Messages.getLocalized("noProfile.title", ""),
                   Messages.getLocalized("noProfile.message", ""),
                   window);
        window.close();
        return;
      }

      elements.wizard.setAttribute("title", Messages.getLocalized("title", ""));

      if (window.arguments.length && window.arguments[0])
        this.migrated = window.arguments[0];
    },

    onFinish: function () {
      let continueButtonIndex;
      let button;

      if (Messages.getLocalized("next.continue", "")) {
        continueButtonIndex = 0;
        let flags = Ci.nsIPromptService.BUTTON_POS_0 * Ci.nsIPromptService.BUTTON_TITLE_IS_STRING +
                    Ci.nsIPromptService.BUTTON_POS_1 * Ci.nsIPromptService.BUTTON_TITLE_IS_STRING;
        button = Util.confirmEx(
          window,
          Messages.getLocalized("next.title", ""),
          Messages.getLocalized("next.message", ""),
          flags,
          Messages.getLocalized("next.continue", ""),
          Messages.getLocalized("next.exit", ""),
          null
        );
      } else {
        continueButtonIndex = -1;
        let flags = Ci.nsIPromptService.BUTTON_POS_0 * Ci.nsIPromptService.BUTTON_TITLE_IS_STRING;

        if (Wizard.migrated) {
          button = Util.confirmEx(
            window,
            Messages.getLocalized("next.title", ""),
            Messages.getLocalized("next.message", ""),
            flags,
            Messages.getLocalized("next.exit", ""),
            null,
            null
          );
        } else {
          // Do not display dialog
          button = !continueButtonIndex;
        }
      }

      switch (button) {
      case continueButtonIndex:
        setTimeout(function (migrated) {
          MigrationManager.beginWizard(migrated);
        }, 100, this.migrated);
        elements.wizard.calcel();
        break;
      default:
        if (Wizard.migrated)
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
      this.enterPhase(this.phase.showProfileList);
      this.header = Messages.getLocalized("profileList.header", "");
      this.message = Messages.getLocalized("profileList", "");
      if (this.profileListUpdated)
        return;

      this.updateProfileList();
      this.profileListUpdated = true;
    },

    onConfirmationPageShow: function () {
      this.enterPhase(this.phase.enterCalculatingPage);

      this.header = Messages.getLocalized("calculating.header", "");
      this.message = Messages.getLocalized("calculating", "");
      elements.wizard.canAdvance = false;
      elements.wizard.canRewind  = false;

      let that = this;
      this.setProfile(this.getSelectedProfile())
        .then(function() {
          that.enterPhase(that.phase.enterConfirmPage);
          that.header = Messages.getLocalized("confirmation.header", "");
          that.message = Messages.getLocalized("confirmation", "");
          elements.wizard.canAdvance = true;
          elements.wizard.canRewind  = true;
        });
    },

    onMigratingPageShow: function () {
      this.enterPhase(this.phase.enterMigratingPage);
      elements.migratingProfile.value = elements.migrationProfile.value;
      elements.migratingAccount.value = elements.migrationAccount.value;
      this.header = Messages.getLocalized("migrating.header", "");
      this.message = Messages.getLocalized("migrating", "");

      let { wizard } = elements;

      if (!this.currentMigrator) {
        let error = StringBundle.nc4migrator.GetStringFromName("migrationError_noMigrator");
        this.message = StringBundle.nc4migrator.formatStringFromName("migrationError", [error], 1);
        wizard.advance(null); // proceed next page
        return;
      }

      wizard.canAdvance = false;
      wizard.canRewind  = false;

      let that = this;
      this.currentMigrator
        .migrate(function onProgress(progress) {
          let percentage = Math.min(100, parseInt(progress * 100));
          elements.migrationProgressMeter.value = percentage;
        })
        .then(function () {
          that.migrated = true;
          return StringBundle.nc4migrator.formatStringFromName("migrationSuccess", [elements.migrationProfile.value], 1);
        })
        .catch(function (x) {
          return StringBundle.nc4migrator.formatStringFromName("migrationError", [x], 1);
        })
        .then(function (message) {
          elements.migrationResultMessage.textContent = message;

          wizard.canAdvance = true;
          wizard.canRewind  = true;
          wizard.advance(null); // proceed next page
        });
    },

    onFinishPageShow: function () {
      this.enterPhase(this.phase.enterFinishPage);
      this.header = Messages.getLocalized("finish.header", "");
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

      var selectedIndex = -1;
      this.ncProfiles.forEach(function (ncProfile, i) {
        var name = ncProfile.name;
        var prettyName = name,
            originalPrettyName = name;
        var migrated = ncProfile.migrated;

        var mail = ncProfile.mailAddress;
        if (mail) {
          prettyName = name + " <" + mail + ">";
          originalPrettyName = prettyName;
          if (migrated)
            prettyName = StringBundle.nc4migrator.formatStringFromName("migratedProfileName", [prettyName], 1);

          if (selectedIndex < 0)
            selectedIndex = i;
        }
        else {
          prettyName = StringBundle.nc4migrator.formatStringFromName("invalidProfileName", [prettyName], 1);
        }
        var item = elements.migrationProfileList.appendItem(
          prettyName, name
        );

        item.setAttribute("name", originalPrettyName);
        if (migrated)
          item.setAttribute("migrated", true);
        if (!mail)
          item.setAttribute("disabled", true);
      });

      if (selectedIndex >= 0)
        elements.migrationProfileList.selectedIndex = selectedIndex;
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
          Messages.getLocalized("reimport.title", ""),
          Messages.getLocalized("reimport.message_before", "") +
            selectedItem.getAttribute("name") +
            Messages.getLocalized("reimport.message_after", ""),
          flags,
          Messages.getLocalized("reimport.continue", ""),
          Messages.getLocalized("reimport.cancel", ""),
          null
        );
        if (button != BUTTON_CONTINUE)
          return false;
      }

      return true;
    },

    setProfile: function (ncProfile) {
      if (!ncProfile) {
        return Promise.resolve();
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
              .then(function(aResult) {
                var quota = Util.formatBytes(aResult.size).join(" ");
                var sizeInMB = (aResult.size || 1) / (1024 * 1024);
                var estimatedTime = Util.formatTime(Math.round(migrator.elapsedTimePer1MB * sizeInMB)).join(" ");

                if (aResult.complete) {
                  elements.migrationQuota.value = quota;
                  elements.migrationEstimatedTime.value = estimatedTime;
                } else {
                  elements.migrationQuota.value = StringBundle.nc4migrator.formatStringFromName("calculatedValueOver", [quota], 1);
                  elements.migrationEstimatedTime.value = StringBundle.nc4migrator.formatStringFromName("calculatedValueOver", [estimatedTime], 1);
                }

                elements.migrationQuotaRow.hidden = false;
                elements.migrationEstimatedTimeRow.hidden = false;
                elements.migrationQuotaAndEstimatedTimeRow.hidden = true;
              })
              .catch(function(x) {
                Util.alert(x);
              });
    },

    confirmToRestart: function () {
      if (Prefs.get("extensions.nc4migrator.forceRestart", false)) {
        Util.restartApplication();
        return;
      }

      const BUTTON_RESTART = 0;
      const BUTTON_STAY    = 1;
      let flags = Ci.nsIPromptService.BUTTON_POS_0 * Ci.nsIPromptService.BUTTON_TITLE_IS_STRING +
                  Ci.nsIPromptService.BUTTON_POS_1 * Ci.nsIPromptService.BUTTON_TITLE_IS_STRING;
      let button = Util.confirmEx(
        window,
        Messages.getLocalized("restart.title", ""),
        Messages.getLocalized("restart.message", ""),
        flags,
        Messages.getLocalized("restart.restart", ""),
        Messages.getLocalized("restart.stay", ""),
        null
      );

      switch (button) {
      case BUTTON_RESTART:
        Util.restartApplication();
        break;
      default:
        break;
      }
    },

    currentMigrator: null,
    migrated : false,

    get canCancel() {
      return !elements.wizard._cancelButton.disabled;
    },
    set canCancel(value) {
      elements.wizard._cancelButton.disabled = !value;
      return value;
    },

    set header(text) {
      elements.wizard.currentPage.setAttribute("label", text);
      elements.wizard._wizardHeader.setAttribute("label", text);
      return text;
    },
    set message(text) {
      let slot = elements.wizard.currentPage.querySelector("description.wizard-page-message");
      if (slot) slot.textContent = text;
      return text;
    },

    // like enum
    phase: [
      "showProfileList",
      "enterCalculatingPage",
      "enterConfirmPage",
      "enterMigratingPage",
      "enterFinishPage"
    ].reduce(function (hash, key, id) (hash[key] = id, hash), {}),

    enterPhase: function (phase) {
      let canCancel = true;

      switch (phase) {
      case this.phase.showProfileList:
      case this.phase.enterConfirmPage:
        canCancel = true;
        break;
      case this.phase.enterCalculatingPage:
      case this.phase.enterMigratingPage:
      case this.phase.enterFinishPage:
        canCancel = false;
        break;
      default:
        throw Error("Unknown phase");
      }

      this.canCancel = canCancel;
    }
  };

  exports.Wizard = Wizard;
})(window);
