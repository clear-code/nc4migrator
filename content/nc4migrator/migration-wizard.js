"use strict";

(function (exports) {
  const Cc = Components.classes;
  const Ci = Components.interfaces;
  const Cu = Components.utils;
  const Cr = Components.results;

  const { Util } = Cu.import("chrome://nc4migrator/content/modules/Util.js", {});

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
    get migrationEstimatedMigrationTime() $("migration-estimated-migration-time")
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
      alert("Selected Item: " + this.getSelectedProfile());
      this.setProfile(this.getSelectedProfile());
    },

    // ------------------------------------------------------------
    // Functions
    // ------------------------------------------------------------

    // elements.migrationProfileList.appendChild(
    //   createElement("radio", {
    //     label: name,
    //     value: name,
    //     disabled: [true, false][Date.now % 2 ]
    //   })
    // );

    profiles: ["hogehoge", "hugahuga", "herohero"],
    updateProfileList: function () {
      this.profiles.forEach(function (profile) {
        var name = profile;

        var item = elements.migrationProfileList.appendItem(
          name, name
        );

        item.disabled = [true, false][Date.now % 2 ];
      }, this);
    },

    getSelectedProfile: function () {
      var selectedItem = elements.migrationProfileList.selectedItem;
      return selectedItem ? selectedItem.getAttribute("value") : null;
    },

    setProfile: function (profile) {
      if (!profile)
        return;

      var name    = profile;
      var account = profile;
      var quota   = profile;

      elements.migrationProfile.value = name;
      elements.migrationAccount.value = account;
      elements.migrationQuota.value = quota;
    }
  };

  exports.Wizard = Wizard;
})(window);
