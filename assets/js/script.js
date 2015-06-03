var Config = function(pluginSet) {

  var self = this;

  var download = function() {
    // TODO: code to produce downlad-able config
    return false;
  }

  self.renderBuildHtml = function() {
    [ "input", "filter", "output" ].forEach(function(pluginType) {
      var pluginTypeLibraryEl = $( '#' + pluginType + '-plugins .panel-body' );
      pluginSet.getPluginsOfType(pluginType).forEach(function(pluginName) {
        var pluginEl = $( "<button>" ).text(pluginName).addClass("btn").addClass("btn-default");
        pluginTypeLibraryEl.append(pluginEl);

        pluginEl.hover(function(e) {
          pluginSet.getPlugin(pluginType, pluginName, function(pluginDetails) {
            pluginEl.tooltip({
              title: pluginDetails.description,
              placement: "auto left"
            });
            pluginEl.tooltip("toggle");
          });
        });

        pluginEl.click(function(e) {
          // Add plugin to view area
          pluginSet.getPlugin(pluginType, pluginName, function(pluginDetails) {
            console.log("Plugin details (before creating Plugin): ", pluginDetails);
            var plugin = new Plugin(pluginDetails);
            plugin.renderViewHtml();
          });
        });
      });
    });
  };

  self.renderViewHtml = function() {
    [ "input", "filter", "output" ].forEach(function(pluginType) {
      var pluginTypeListEl = $( "#view #config #" + pluginType + " .plugin-list");
      pluginTypeListEl.sortable();
      pluginTypeListEl.disableSelection();

      var pluginTypeEl = pluginTypeListEl.parent();
      pluginTypeEl.hide();

      pluginTypeListEl.click(function(e) {
        if (pluginTypeListEl.children().length == 0) {
          pluginTypeEl.hide();
        }
      })
    });

    $( "#download-config" ).click(download);
  }
}

var Plugin = function(pluginDetails) {
  var self = this;

  self.renderViewHtml = function() {

    var pluginAttributeListEl = $("<ul>");
    for (attributeName in pluginDetails.attributes) {
      var attribute = pluginDetails.attributes[attributeName];

      if (!attribute.deprecated
        && (attribute.required || !attribute.default)) {

        var labelEl = $("<label>")
          .text(attributeName);

        var inputEl = $("<input>")
          .attr("type", "textbox")
          .attr("placeholder", attribute.dataType)
          .val(attribute.default);

        var attrEl = $("<li>")
          .append(labelEl)
          .append(document.createTextNode(" => "))
          .append(inputEl)
          .tooltip({ title: attribute.description, placement: "bottom" })
          .hover(function(e) {
            $(e.target).tooltip("show");
          });

        pluginAttributeListEl.append(attrEl);

      }
    }

    var pluginEl = $("<li>")
      .addClass("plugin")
      .append(document.createTextNode(pluginDetails.name + " {\n"))
      .append(pluginAttributeListEl)
      .append(document.createTextNode("}\n"));

    // Add 'x' to delete plugin
    var pluginIconEl = $("<span>")
      .addClass("glyphicon")
      .addClass("glyphicon-trash");
    var pluginDeleteEl = $("<a>")
      .attr("href", "#delete-" + pluginDetails.type + "-plugin")
      .append(pluginIconEl);
    pluginEl.append(pluginDeleteEl);
    pluginDeleteEl.click(function(e) {
      pluginEl.remove();
    })

    // Add to list in view area
    var pluginTypeListEl = $( "#view #config #" + pluginDetails.type + " .plugin-list");
    pluginTypeListEl.parent().show();
    pluginTypeListEl.append(pluginEl);
  }

}

var PluginSet = function() {

  var self = this;

  var sortPlugins = function(plugins) {
    for (pluginType in plugins.sorted) {
      plugins.sorted[pluginType].sort();
    }
  }

  var pluginRepoNameRegexp = /logstash-(input|filter|output|codec)-(\w+)/;
  var fetchPluginsFromGitHub = function(plugins, page, cb) {
    var url = "http://api.github.com/orgs/logstash-plugins/repos?page=" + page;
    console.log("Fetching " + url + "...");
    $.ajax({
      url: url
    }).then(function(data, status, xhr) {
      if (data.length > 0) {
        data.forEach(function(repo) {
          var matches = repo.name.match(pluginRepoNameRegexp);
          if (matches) {
            var pluginType = matches[1];
            var pluginName = matches[2];
            plugins.sorted[pluginType].push(pluginName);
            plugins.unsorted[pluginType][pluginName] = {
              name: pluginName,
              type: pluginType
            }; // TODO: Add more meat
          }
        });
        fetchPluginsFromGitHub(plugins, ++page, cb);
      } else {
        sortPlugins(plugins);
        cb();
      }
    });
  };

  var fetchPluginFileFromGitHub = function(type, name, cb) {
    var fileUrl = "https://api.github.com/repos/logstash-plugins/"
      + "logstash-" + type + "-" + name + "/"
      + "contents/lib/logstash/" + type + "s/" + name + ".rb"
    console.log("Fetching " + fileUrl + "...");
    $.ajax({
      url: fileUrl
    }).then(function(data, status, xhr) {
      cb(atob(data.content));
    });
  }

  var parsePluginFile = function(fileContents) {
    // Based on https://github.com/elastic/logstash/blob/master/docs/asciidocgen.rb#L18-L30

    var comments = [];

    var description = "";
    var attributes = {};

    var COMMENT_RE     = /^ *#(?: (.*)| *$)/,
      CLASS_DEF_RE     = /^ *class.*< *(::)?LogStash::(Outputs|Filters|Inputs|Codecs)::(Base|Threadable)/,
      CONFIG_RE        = /^ *config :+([^,]+),(.*)/, // modified from original!
      CONFIG_NAME_RE   = /^ *config_name .*/,
      MILESTONE_RE     = /^ *milestone .*/,
      FLAG_RE          = /^ *flag[( ].*/,
      CLEAR_COMMENT_RE = /^ *(class|def|module) /;

    fileContents.split("\n").forEach(function(line) {
      var matches;
      if ((matches = line.match(COMMENT_RE))) {
        var comment = matches[1];
        if (comment != "encoding: utf-8") {
          comments.push(matches[1]);
        }
      } else if (matches = line.match(CONFIG_RE)) {
        var name = matches[1];
        var rest = matches[2];
        attributes[name] = {
          dataType: null,
          default: null,
          description: comments.join("\n")
        };
        rest.split(",").forEach(function(item) {
          item = item.trim();
          var itemMatches = item.match(/:([^= ]+) *=> *(:?(.*))/);
          if (itemMatches) {
            switch (itemMatches[1]) {
              case 'validate':
                attributes[name].dataType = itemMatches[3];
                break;
              case 'default':
                attributes[name].default = itemMatches[2];
                break;
              case 'required':
                attributes[name].required = (itemMatches[2] == "true");
                break;
              case 'deprecated':
                attributes[name].deprecated = (itemMatches[2] == "true");
                break;
            }
          }
        });
        comments = [];
      } else if (matches = line.match(CLASS_DEF_RE)) {
        var descriptionComplete = comments.join("\n");
        var descriptionParagraphs = descriptionComplete.split(/\n\n/);
        description = descriptionParagraphs[0];
        comments = [];
      } else if (matches = line.match(CLEAR_COMMENT_RE)) {
        comments = [];
      }
    });

    return {
      description: description,
      attributes: attributes
    };

  }

  self.init = function(cb) {
    var plugins = window.sessionStorage.getItem('ls_plugins');
    if (!plugins) {
      plugins = {
        sorted: {
          input: [],
          filter: [],
          output: [],
          codec: []
        },
        unsorted: {
          input: {},
          filter: {},
          output: {},
          codec: {}
        }
      };
      fetchPluginsFromGitHub(plugins, 1, function() {
        window.sessionStorage.setItem('ls_plugins', JSON.stringify(plugins));
        cb();
      });
    } else {
      cb();
    }
  }

  self.getPluginsOfType = function(type) {
    var plugins = JSON.parse(window.sessionStorage.getItem('ls_plugins'));
    return plugins.sorted[type];
  }

  self.getPlugin = function(type, name, cb) {
    var plugins = JSON.parse(window.sessionStorage.getItem('ls_plugins'));
    var plugin = plugins.unsorted[type][name];
    if (!(plugin.description || plugin.attributes)) {
      fetchPluginFileFromGitHub(type, name, function(fileContents) {
        var pluginDetails = parsePluginFile(fileContents);
        plugin.description = pluginDetails.description;
        plugin.attributes = pluginDetails.attributes;

        plugins.unsorted[type][name] = plugin;
        window.sessionStorage.setItem('ls_plugins', JSON.stringify(plugins));

        cb(plugin);
      });
    } else {
      cb(plugin);
    }
  }

}

// "Main"
$(function() {
  var pluginSet = new PluginSet();
  pluginSet.init(function() {
    var config = new Config(pluginSet);
    config.renderBuildHtml();
    config.renderViewHtml();

    var tour = new Tour({
      steps: [
        {
          element: "#available-plugins h2",
          title: "Step 1",
          content: "Start by browsing through the set of"
            + " available Logstash plugins below. When you see one"
            + " you like, just click on it to add it to the"
            + " configuration file."
        },
        {
          element: "#view .tour-anchor",
          title: "Step 2",
          content: "When you click on a plugin you like, it will be"
            + " added here, along with its configuration options.<br /><br />"
            + " <em>Tip: You can change the order of plugins by"
            + " dragging them up or down.</em>"
        },
        {
          element: "#download-config",
          title: "Step 3",
          content: "When you are done building your Logstash configuration file,"
            + " click this button to download it so you can run it with:<br /><br />"
            + " <pre>logstash --config /path/to/downloaded/file</pre>"
        }
      ]
    });
    tour.init();
    tour.start();

  });

});
