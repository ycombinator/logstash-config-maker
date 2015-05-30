var Config = function(pluginSet) {

  var self = this;

  self.renderBuildHtml = function() {
    [ "input", "filter", "output" ].forEach(function(pluginType) {
      var pluginTypeLibraryEl = $( '#' + pluginType + '-plugins .panel-body' );
      pluginSet.getPluginsOfType(pluginType).forEach(function(pluginName) {
        var pluginEl = $( "<button>" ).text(pluginName).addClass("btn").addClass("btn-default");
        pluginTypeLibraryEl.append(pluginEl);

        pluginEl.click(function(e) {
          // Add plugin to view area
          var plugin = new Plugin(pluginSet.getPlugin(pluginType, pluginName));
          plugin.renderViewHtml();
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
  }
}

var Plugin = function(plugin) {
  var self = this;

  self.renderViewHtml = function() {

    var pluginEl = $("<li>")
      .addClass("plugin")
      .text(plugin.name + " {\n" + "}\n");

    // Add 'x' to delete plugin
    var pluginDeleteImgEl = $("<img>")
      .attr("src", "assets/images/trash.png")
      .attr("width", "16px")
      .attr("height", "16px");
    var pluginDeleteEl = $("<a>")
      .attr("href", "#delete-" + plugin.type + "-plugin")
      .append(pluginDeleteImgEl);
    pluginEl.append(pluginDeleteEl);
    pluginDeleteEl.click(function(e) {
      pluginEl.remove();
    })

    // Add to list in view area
    var pluginTypeListEl = $( "#view #config #" + plugin.type + " .plugin-list");
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
    $.ajax({
      url: "http://api.github.com/orgs/logstash-plugins/repos?page=" + page
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

  var parsePluginFile = function(fileContents) {
  //
  // def initialize
  //   @rules = {
  //     COMMENT_RE => lambda { |m| add_comment(m[1]) },
  //     /^ *class.*< *(::)?LogStash::(Outputs|Filters|Inputs|Codecs)::(Base|Threadable)/ => \
  //       lambda { |m| set_class_description },
  //     /^ *config +[^=].*/ => lambda { |m| add_config(m[0]) },
  //     /^ *milestone .*/ => lambda { |m| set_milestone(m[0]) },
  //     /^ *config_name .*/ => lambda { |m| set_config_name(m[0]) },
  //     /^ *flag[( ].*/ => lambda { |m| add_flag(m[0]) },
  //     /^ *(class|def|module) / => lambda { |m| clear_comments },
  //   }
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

  self.getPlugin = function(type, name) {
    var plugins = JSON.parse(window.sessionStorage.getItem('ls_plugins'));
    return plugins.unsorted[type][name];
  }

}

$(function() {
  var pluginSet = new PluginSet();
  pluginSet.init(function() {
    var config = new Config(pluginSet);
    config.renderBuildHtml();
    config.renderViewHtml();
  });
});
