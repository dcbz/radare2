/* radare2 Copyleft 2013-2014 pancake */

var r2 = {};

// TODO: avoid globals
var backward = false;
var next_curoff = 0;
var next_lastoff = 0;
var prev_curoff = 0;
var prev_lastoff = 0;
var hascmd = false;

// async helper
function asyncLoop(iterations, func, callback) {
  var index = 0;
  var done = false;
  var loop = {
    next: function() {
      if (done) {
        return;
      }

      if (index < iterations) {
        index++;
        func(loop);

      } else {
        done = true;
        callback();
      }
    },

    iteration: function() {
      return index - 1;
    },

    break: function() {
      done = true;
      callback();
    }
  };
  loop.next();
  return loop;
}

if (typeof (module) !== 'undefined') {
  module.exports = function(r) {
    if (typeof (r) == 'function') {
      hascmd = r;
    } else {
      hascmd = r.cmd;
    }
    return r2;
  }
}

r2.plugin = function() {
  console.error ("r2.plugin is not available in this environment");
}
try {
  if (r2plugin) {
    r2.plugin = r2plugin
  }
} catch ( e ) {}

r2.root = ""; // prefix path

/* helpers */
function dump(obj) {
  var x = "";
  for (var a in obj) x += a + "\n";
  if (typeof ('alert') != 'undefined') {
    alert (x);
  } else {
    console.log (x);
  }
}

r2.analOp = function(addr, cb) {
  r2.cmd ("aoj 1 @ " + addr, function(txt) {
    try {
      cb(JSON.parse (txt)[0]);
    } catch ( e ) {
      console.error (e)
      cb (txt);
    }
  });
}

function objtostr(obj) {
  var str = "";
  for (var a in obj)
    str += a + ": " + obj[a] + ",\n";
  return str;
}

function Ajax(method, uri, body, fn) {
  if (typeof (XMLHttpRequest) == "undefined")
    return false;
  var x = new XMLHttpRequest ();
  if (!x)
    return false;
  x.open (method, uri, false);
  x.setRequestHeader ('Accept', 'text/plain');
  x.setRequestHeader ('Accept', 'text/html');
  x.setRequestHeader ("Content-Type", "application/x-ww-form-urlencoded; charset=UTF-8");
  x.onreadystatechange = function(y) {
    if (x.status == 200) {
      if (fn) {
        fn (x.responseText);
      }
    } else {
      console.error ("ajax " + x.status)
    }
  }
  x.send (body);
  return true;
}

r2.assemble = function(offset, opcode, fn) {
  var off = offset ? "@" + offset : '';
  r2.cmd ('"pa ' + opcode + '"' + off, fn);
}

r2.disassemble = function(offset, bytes, fn) {
  var off = offset ? "@" + offset : '';
  var str = 'pi @b:' + bytes + off;
  r2.cmd (str, fn);
}

r2.get_hexdump = function(offset, length, cb) {
  r2.cmd ("px " + length + "@" + offset, cb);
}
r2.get_disasm = function(offset, length, cb) {
  // TODO: honor offset and length
  r2.cmd ("pD " + length + "@" + offset, cb);
}

r2.Config = function(k, v, fn) {
  if (typeof v == 'function' || !v) { // get
    r2.cmd ("e " + k, fn || v);
  } else { // set
    r2.cmd ("e " + k + "=" + v, fn);
  }
  return r2;
}

r2.set_flag_space = function(ns, fn) {
  r2.cmd ("fs " + ns, fn);
}

r2.get_flags = function(fn) {
  r2.cmd ("fj", function(x) {
    fn (x ? JSON.parse (x) : []);
  });
}

r2.get_opcodes = function(off, n, cb) {
  r2.cmd ("pdj @" + off + "!" + n, function(json) {
    cb (JSON.parse (json));
  });
}

r2.get_bytes = function(off, n, cb) {
  r2.cmd ("pcj @" + off + "!" + n, function(json) {
    cb (JSON.parse (json));
  });
}

r2.get_info = function(cb) {
  r2.cmd ("ij", function(json) {
    cb (JSON.parse (json));
  });
}
r2.bin_relocs = function(cb) {
  r2.cmd ("irj", function(json) {
    cb (JSON.parse (json));
  });
}
r2.bin_imports = function(cb) {
  r2.cmd ("iij", function(json) {
    cb (JSON.parse (json));
  });
}

r2.bin_symbols = function(cb) {
  r2.cmd ("isj", function(json) {
    cb (JSON.parse (json));
  });
}

r2.bin_sections = function(cb) {
  r2.cmd ("iSj", function(json) {
    cb (JSON.parse (json));
  });
}

r2.cmds = function(cmds, cb) {
  if (cmds.length == 0) return;
  var cmd = cmds[0];
  cmds = cmds.splice (1);
  function lala() {
    if (cmd == undefined || cmds.length == 0) {
      return;
    }
    cmd = cmds[0];
    cmds = cmds.splice (1);
    r2.cmd (cmd, lala);
    if (cb) {
      cb ();
    }
    return;
  }
  r2.cmd (cmd, lala);
}

function _internal_cmd(c, cb) {
  if (typeof (r2cmd) != 'undefined') {
    hascmd = r2cmd;
  }
  if (hascmd) {
    // TODO: use setTimeout for async?
    if (typeof (r2plugin) != "undefined") {
      // duktape
      cb (r2cmd(c));
    } else {
      // node
      return hascmd (c, cb);
    }
  } else {
    Ajax ('GET', r2.root + "/cmd/" + encodeURI (c), '', function(x) {
      if (cb) {
        cb (x);
      }
    });
  }
}

r2.cmd = function(c, cb) {
  if (Array.isArray (c)) {
    var res = [];
    var idx = 0;
    asyncLoop (c.length, function(loop) {
      _internal_cmd (c[idx], function(result) {
        idx = loop.iteration();
        res[idx] = result.replace(/\n$/, "");
        idx++;
        loop.next ();
      });
    }, function() {
        // all iterations done
        cb (res);
      });
  } else {
    _internal_cmd (c, cb);
  }
}

r2.cmdj = function(c, cb) {
  r2.cmd (c, function(x) {
    try {
      cb (JSON.parse(x));
    } catch ( e ) {
      cb (null);
    }
  });
}

r2.alive = function(cb) {
  r2.cmd ("b", function(o) {
    var ret = false;
    if (o && o.length () > 0) {
      ret = true;
    }
    if (cb) {
      cb (o);
    }
  });
}

r2.getTextLogger = function(obj) {
  if (typeof (obj) != "object") {
    obj = {};
  }
  obj.last = 0;
  obj.events = {};
  obj.interval = null;
  r2.cmd ("Tl", function(x) {
    obj.last = +x;
  });
  obj.load = function(cb) {
    r2.cmd ("Tj " + (obj.last + 1), function(ret) {
      if (cb) {
        cb (JSON.parse (ret));
      }
    });
  }
  obj.clear = function(cb) {
    // XXX: fix l-N
    r2.cmd ("T-", cb); //+obj.last, cb);
  }
  obj.send = function(msg, cb) {
    r2.cmd ("T " + msg, cb);
  }
  obj.refresh = function(cb) {
    obj.load (function(ret) {
      //obj.last = 0;
      for (var i = 0; i < ret.length; i++) {
        var message = ret[i];
        obj.events["message"] ({
          "id": message[0],
          "text": message[1]
        });
        if (message[0] > obj.last) {
          obj.last = message[0];
        }
      }
      if (cb) {
        cb ();
      }
    });
  }
  obj.autorefresh = function(n) {
    if (!n) {
      if (obj.interval) {
        obj.interval.stop ();
      }
      return;
    }
    function to() {
      obj.refresh (function() {
        //obj.clear ();
      });
      setTimeout (to, n * 1000);
      return true;
    }
    obj.interval = setTimeout (to, n * 1000);
  }
  obj.on = function(ev, cb) {
    obj.events[ev] = cb;
    return obj;
  }
  return obj;
}

r2.filter_asm = function(x, display) {
  var curoff = backward ? prev_curoff : next_curoff;
  ;
  var lastoff = backward ? prev_lastoff : next_lastoff;
  ;
  var lines = x.split (/\n/g);
  r2.cmd ("s", function(x) {
    curoff = x;
  });
  for (var i = lines.length - 1; i > 0; i--) {
    var a = lines[i].match (/0x([a-fA-F0-9]+)/);
    if (a && a.length > 0) {
      lastoff = a[0].replace (/:/g, "");
      break;
    }
  }
  if (display == "afl") {
    //hasmore (false);
    var z = "";
    for (var i = 0; i < lines.length; i++) {
      var row = lines[i].replace (/\ +/g, " ").split (/ /g);
      z += row[0] + "  " + row[3] + "\n";
    }
    x = z;
  } else if (display[0] == 'f') {
    //hasmore (false);
    if (display[1] == 's') {
      var z = "";
      for (var i = 0; i < lines.length; i++) {
        var row = lines[i].replace (/\ +/g, " ").split (/ /g);
        var mark = row[1] == '*' ? '*' : ' ';
        var space = row[2] ? row[2] : row[1];
        if (!space) continue;
        z += row[0] + " " + mark + " <a href=\"javascript:runcmd('fs " +
        space + "')\">" + space + "</a>\n";
      }
      x = z;
    } else {
    }
  } else if (display[0] == "i") {
    //hasmore (false);
    if (display[1]) {
      var z = "";
      for (var i = 0; i < lines.length; i++) {
        var elems = lines[i].split (/ /g);
        var name = "";
        var addr = "";
        for (var j = 0; j < elems.length; j++) {
          var kv = elems[j].split (/=/);
          if (kv[0] == "addr") {
            addr = kv[1];
          }
          if (kv[0] == "name") {
            name = kv[1];
          }
          if (kv[0] == "string") {
            name = kv[1];
          }
        }
        z += addr + "  " + name + "\n";
      }
      x = z;
    }
  } //else hasmore (true);

  function haveDisasm(x) {
    if (x[0] == 'p' && x[1] == 'd') return true;
    if (x.indexOf (";pd") != -1) return true;
    return false;
  }
  if (haveDisasm (display)) {
    x = x.replace (/function:/g, "<span style=color:green>function:</span>");
    x = x.replace (/;(\s+)/g, ";");
    x = x.replace (/;(.*)/g, "// <span style='color:#209020'>$1</span>");
    x = x.replace (/(bl|goto|call)/g, "<b style='color:green'>call</b>");
    x = x.replace (/(jmp|bne|beq|js|jnz|jae|jge|jbe|jg|je|jl|jz|jb|ja|jne)/g, "<b style='color:green'>$1</b>");
    x = x.replace (/(dword|qword|word|byte|movzx|movsxd|cmovz|mov\ |lea\ )/g, "<b style='color:#1070d0'>$1</b>");
    x = x.replace (/(hlt|leave|iretd|retn|ret)/g, "<b style='color:red'>$1</b>");
    x = x.replace (/(add|sbb|sub|mul|div|shl|shr|and|not|xor|inc|dec|sar|sal)/g, "<b style='color:#d06010'>$1</b>");
    x = x.replace (/(push|pop)/g, "<b style='color:#40a010'>$1</b>");
    x = x.replace (/(test|cmp)/g, "<b style='color:#c04080'>$1</b>");
    x = x.replace (/(outsd|out|string|invalid|int |int3|trap|main|in)/g, "<b style='color:red'>$1</b>");
    x = x.replace (/nop/g, "<b style='color:blue'>nop</b>");
    x = x.replace (/(sym|fcn|str|imp|loc).([^:<(\\\/ \|)\->]+)/g, "<a href='javascript:r2ui.seek(\"$1.$2\")'>$1.$2</a>");
  }
  x = x.replace (/0x([a-zA-Z0-9]+)/g, "<a href='javascript:r2ui.seek(\"0x$1\")'>0x$1</a>");
  // registers
  if (backward) {
    prev_curoff = curoff;
    prev_lastoff = lastoff;
  } else {
    next_curoff = curoff;
    next_lastoff = lastoff;
    if (!prev_curoff) {
      prev_curoff = next_curoff;
    }
  }
  return x;
}

