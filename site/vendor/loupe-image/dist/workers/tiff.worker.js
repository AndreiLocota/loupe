var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});
var __commonJS = (cb, mod) => function __require2() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// node_modules/pako/lib/utils/common.js
var require_common = __commonJS({
  "node_modules/pako/lib/utils/common.js"(exports) {
    "use strict";
    var TYPED_OK = typeof Uint8Array !== "undefined" && typeof Uint16Array !== "undefined" && typeof Int32Array !== "undefined";
    function _has(obj, key) {
      return Object.prototype.hasOwnProperty.call(obj, key);
    }
    exports.assign = function(obj) {
      var sources = Array.prototype.slice.call(arguments, 1);
      while (sources.length) {
        var source = sources.shift();
        if (!source) {
          continue;
        }
        if (typeof source !== "object") {
          throw new TypeError(source + "must be non-object");
        }
        for (var p in source) {
          if (_has(source, p)) {
            obj[p] = source[p];
          }
        }
      }
      return obj;
    };
    exports.shrinkBuf = function(buf, size) {
      if (buf.length === size) {
        return buf;
      }
      if (buf.subarray) {
        return buf.subarray(0, size);
      }
      buf.length = size;
      return buf;
    };
    var fnTyped = {
      arraySet: function(dest, src, src_offs, len, dest_offs) {
        if (src.subarray && dest.subarray) {
          dest.set(src.subarray(src_offs, src_offs + len), dest_offs);
          return;
        }
        for (var i = 0; i < len; i++) {
          dest[dest_offs + i] = src[src_offs + i];
        }
      },
      // Join array of chunks to single array.
      flattenChunks: function(chunks) {
        var i, l, len, pos, chunk, result;
        len = 0;
        for (i = 0, l = chunks.length; i < l; i++) {
          len += chunks[i].length;
        }
        result = new Uint8Array(len);
        pos = 0;
        for (i = 0, l = chunks.length; i < l; i++) {
          chunk = chunks[i];
          result.set(chunk, pos);
          pos += chunk.length;
        }
        return result;
      }
    };
    var fnUntyped = {
      arraySet: function(dest, src, src_offs, len, dest_offs) {
        for (var i = 0; i < len; i++) {
          dest[dest_offs + i] = src[src_offs + i];
        }
      },
      // Join array of chunks to single array.
      flattenChunks: function(chunks) {
        return [].concat.apply([], chunks);
      }
    };
    exports.setTyped = function(on) {
      if (on) {
        exports.Buf8 = Uint8Array;
        exports.Buf16 = Uint16Array;
        exports.Buf32 = Int32Array;
        exports.assign(exports, fnTyped);
      } else {
        exports.Buf8 = Array;
        exports.Buf16 = Array;
        exports.Buf32 = Array;
        exports.assign(exports, fnUntyped);
      }
    };
    exports.setTyped(TYPED_OK);
  }
});

// node_modules/pako/lib/zlib/trees.js
var require_trees = __commonJS({
  "node_modules/pako/lib/zlib/trees.js"(exports) {
    "use strict";
    var utils = require_common();
    var Z_FIXED = 4;
    var Z_BINARY = 0;
    var Z_TEXT = 1;
    var Z_UNKNOWN = 2;
    function zero(buf) {
      var len = buf.length;
      while (--len >= 0) {
        buf[len] = 0;
      }
    }
    var STORED_BLOCK = 0;
    var STATIC_TREES = 1;
    var DYN_TREES = 2;
    var MIN_MATCH = 3;
    var MAX_MATCH = 258;
    var LENGTH_CODES = 29;
    var LITERALS = 256;
    var L_CODES = LITERALS + 1 + LENGTH_CODES;
    var D_CODES = 30;
    var BL_CODES = 19;
    var HEAP_SIZE = 2 * L_CODES + 1;
    var MAX_BITS = 15;
    var Buf_size = 16;
    var MAX_BL_BITS = 7;
    var END_BLOCK = 256;
    var REP_3_6 = 16;
    var REPZ_3_10 = 17;
    var REPZ_11_138 = 18;
    var extra_lbits = (
      /* extra bits for each length code */
      [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0]
    );
    var extra_dbits = (
      /* extra bits for each distance code */
      [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13]
    );
    var extra_blbits = (
      /* extra bits for each bit length code */
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 3, 7]
    );
    var bl_order = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];
    var DIST_CODE_LEN = 512;
    var static_ltree = new Array((L_CODES + 2) * 2);
    zero(static_ltree);
    var static_dtree = new Array(D_CODES * 2);
    zero(static_dtree);
    var _dist_code = new Array(DIST_CODE_LEN);
    zero(_dist_code);
    var _length_code = new Array(MAX_MATCH - MIN_MATCH + 1);
    zero(_length_code);
    var base_length = new Array(LENGTH_CODES);
    zero(base_length);
    var base_dist = new Array(D_CODES);
    zero(base_dist);
    function StaticTreeDesc(static_tree, extra_bits, extra_base, elems, max_length) {
      this.static_tree = static_tree;
      this.extra_bits = extra_bits;
      this.extra_base = extra_base;
      this.elems = elems;
      this.max_length = max_length;
      this.has_stree = static_tree && static_tree.length;
    }
    var static_l_desc;
    var static_d_desc;
    var static_bl_desc;
    function TreeDesc(dyn_tree, stat_desc) {
      this.dyn_tree = dyn_tree;
      this.max_code = 0;
      this.stat_desc = stat_desc;
    }
    function d_code(dist) {
      return dist < 256 ? _dist_code[dist] : _dist_code[256 + (dist >>> 7)];
    }
    function put_short(s, w) {
      s.pending_buf[s.pending++] = w & 255;
      s.pending_buf[s.pending++] = w >>> 8 & 255;
    }
    function send_bits(s, value, length) {
      if (s.bi_valid > Buf_size - length) {
        s.bi_buf |= value << s.bi_valid & 65535;
        put_short(s, s.bi_buf);
        s.bi_buf = value >> Buf_size - s.bi_valid;
        s.bi_valid += length - Buf_size;
      } else {
        s.bi_buf |= value << s.bi_valid & 65535;
        s.bi_valid += length;
      }
    }
    function send_code(s, c, tree) {
      send_bits(
        s,
        tree[c * 2],
        tree[c * 2 + 1]
        /*.Len*/
      );
    }
    function bi_reverse(code, len) {
      var res = 0;
      do {
        res |= code & 1;
        code >>>= 1;
        res <<= 1;
      } while (--len > 0);
      return res >>> 1;
    }
    function bi_flush(s) {
      if (s.bi_valid === 16) {
        put_short(s, s.bi_buf);
        s.bi_buf = 0;
        s.bi_valid = 0;
      } else if (s.bi_valid >= 8) {
        s.pending_buf[s.pending++] = s.bi_buf & 255;
        s.bi_buf >>= 8;
        s.bi_valid -= 8;
      }
    }
    function gen_bitlen(s, desc) {
      var tree = desc.dyn_tree;
      var max_code = desc.max_code;
      var stree = desc.stat_desc.static_tree;
      var has_stree = desc.stat_desc.has_stree;
      var extra = desc.stat_desc.extra_bits;
      var base = desc.stat_desc.extra_base;
      var max_length = desc.stat_desc.max_length;
      var h;
      var n, m;
      var bits;
      var xbits;
      var f;
      var overflow = 0;
      for (bits = 0; bits <= MAX_BITS; bits++) {
        s.bl_count[bits] = 0;
      }
      tree[s.heap[s.heap_max] * 2 + 1] = 0;
      for (h = s.heap_max + 1; h < HEAP_SIZE; h++) {
        n = s.heap[h];
        bits = tree[tree[n * 2 + 1] * 2 + 1] + 1;
        if (bits > max_length) {
          bits = max_length;
          overflow++;
        }
        tree[n * 2 + 1] = bits;
        if (n > max_code) {
          continue;
        }
        s.bl_count[bits]++;
        xbits = 0;
        if (n >= base) {
          xbits = extra[n - base];
        }
        f = tree[n * 2];
        s.opt_len += f * (bits + xbits);
        if (has_stree) {
          s.static_len += f * (stree[n * 2 + 1] + xbits);
        }
      }
      if (overflow === 0) {
        return;
      }
      do {
        bits = max_length - 1;
        while (s.bl_count[bits] === 0) {
          bits--;
        }
        s.bl_count[bits]--;
        s.bl_count[bits + 1] += 2;
        s.bl_count[max_length]--;
        overflow -= 2;
      } while (overflow > 0);
      for (bits = max_length; bits !== 0; bits--) {
        n = s.bl_count[bits];
        while (n !== 0) {
          m = s.heap[--h];
          if (m > max_code) {
            continue;
          }
          if (tree[m * 2 + 1] !== bits) {
            s.opt_len += (bits - tree[m * 2 + 1]) * tree[m * 2];
            tree[m * 2 + 1] = bits;
          }
          n--;
        }
      }
    }
    function gen_codes(tree, max_code, bl_count) {
      var next_code = new Array(MAX_BITS + 1);
      var code = 0;
      var bits;
      var n;
      for (bits = 1; bits <= MAX_BITS; bits++) {
        next_code[bits] = code = code + bl_count[bits - 1] << 1;
      }
      for (n = 0; n <= max_code; n++) {
        var len = tree[n * 2 + 1];
        if (len === 0) {
          continue;
        }
        tree[n * 2] = bi_reverse(next_code[len]++, len);
      }
    }
    function tr_static_init() {
      var n;
      var bits;
      var length;
      var code;
      var dist;
      var bl_count = new Array(MAX_BITS + 1);
      length = 0;
      for (code = 0; code < LENGTH_CODES - 1; code++) {
        base_length[code] = length;
        for (n = 0; n < 1 << extra_lbits[code]; n++) {
          _length_code[length++] = code;
        }
      }
      _length_code[length - 1] = code;
      dist = 0;
      for (code = 0; code < 16; code++) {
        base_dist[code] = dist;
        for (n = 0; n < 1 << extra_dbits[code]; n++) {
          _dist_code[dist++] = code;
        }
      }
      dist >>= 7;
      for (; code < D_CODES; code++) {
        base_dist[code] = dist << 7;
        for (n = 0; n < 1 << extra_dbits[code] - 7; n++) {
          _dist_code[256 + dist++] = code;
        }
      }
      for (bits = 0; bits <= MAX_BITS; bits++) {
        bl_count[bits] = 0;
      }
      n = 0;
      while (n <= 143) {
        static_ltree[n * 2 + 1] = 8;
        n++;
        bl_count[8]++;
      }
      while (n <= 255) {
        static_ltree[n * 2 + 1] = 9;
        n++;
        bl_count[9]++;
      }
      while (n <= 279) {
        static_ltree[n * 2 + 1] = 7;
        n++;
        bl_count[7]++;
      }
      while (n <= 287) {
        static_ltree[n * 2 + 1] = 8;
        n++;
        bl_count[8]++;
      }
      gen_codes(static_ltree, L_CODES + 1, bl_count);
      for (n = 0; n < D_CODES; n++) {
        static_dtree[n * 2 + 1] = 5;
        static_dtree[n * 2] = bi_reverse(n, 5);
      }
      static_l_desc = new StaticTreeDesc(static_ltree, extra_lbits, LITERALS + 1, L_CODES, MAX_BITS);
      static_d_desc = new StaticTreeDesc(static_dtree, extra_dbits, 0, D_CODES, MAX_BITS);
      static_bl_desc = new StaticTreeDesc(new Array(0), extra_blbits, 0, BL_CODES, MAX_BL_BITS);
    }
    function init_block(s) {
      var n;
      for (n = 0; n < L_CODES; n++) {
        s.dyn_ltree[n * 2] = 0;
      }
      for (n = 0; n < D_CODES; n++) {
        s.dyn_dtree[n * 2] = 0;
      }
      for (n = 0; n < BL_CODES; n++) {
        s.bl_tree[n * 2] = 0;
      }
      s.dyn_ltree[END_BLOCK * 2] = 1;
      s.opt_len = s.static_len = 0;
      s.last_lit = s.matches = 0;
    }
    function bi_windup(s) {
      if (s.bi_valid > 8) {
        put_short(s, s.bi_buf);
      } else if (s.bi_valid > 0) {
        s.pending_buf[s.pending++] = s.bi_buf;
      }
      s.bi_buf = 0;
      s.bi_valid = 0;
    }
    function copy_block(s, buf, len, header) {
      bi_windup(s);
      if (header) {
        put_short(s, len);
        put_short(s, ~len);
      }
      utils.arraySet(s.pending_buf, s.window, buf, len, s.pending);
      s.pending += len;
    }
    function smaller(tree, n, m, depth) {
      var _n2 = n * 2;
      var _m2 = m * 2;
      return tree[_n2] < tree[_m2] || tree[_n2] === tree[_m2] && depth[n] <= depth[m];
    }
    function pqdownheap(s, tree, k) {
      var v = s.heap[k];
      var j = k << 1;
      while (j <= s.heap_len) {
        if (j < s.heap_len && smaller(tree, s.heap[j + 1], s.heap[j], s.depth)) {
          j++;
        }
        if (smaller(tree, v, s.heap[j], s.depth)) {
          break;
        }
        s.heap[k] = s.heap[j];
        k = j;
        j <<= 1;
      }
      s.heap[k] = v;
    }
    function compress_block(s, ltree, dtree) {
      var dist;
      var lc;
      var lx = 0;
      var code;
      var extra;
      if (s.last_lit !== 0) {
        do {
          dist = s.pending_buf[s.d_buf + lx * 2] << 8 | s.pending_buf[s.d_buf + lx * 2 + 1];
          lc = s.pending_buf[s.l_buf + lx];
          lx++;
          if (dist === 0) {
            send_code(s, lc, ltree);
          } else {
            code = _length_code[lc];
            send_code(s, code + LITERALS + 1, ltree);
            extra = extra_lbits[code];
            if (extra !== 0) {
              lc -= base_length[code];
              send_bits(s, lc, extra);
            }
            dist--;
            code = d_code(dist);
            send_code(s, code, dtree);
            extra = extra_dbits[code];
            if (extra !== 0) {
              dist -= base_dist[code];
              send_bits(s, dist, extra);
            }
          }
        } while (lx < s.last_lit);
      }
      send_code(s, END_BLOCK, ltree);
    }
    function build_tree(s, desc) {
      var tree = desc.dyn_tree;
      var stree = desc.stat_desc.static_tree;
      var has_stree = desc.stat_desc.has_stree;
      var elems = desc.stat_desc.elems;
      var n, m;
      var max_code = -1;
      var node;
      s.heap_len = 0;
      s.heap_max = HEAP_SIZE;
      for (n = 0; n < elems; n++) {
        if (tree[n * 2] !== 0) {
          s.heap[++s.heap_len] = max_code = n;
          s.depth[n] = 0;
        } else {
          tree[n * 2 + 1] = 0;
        }
      }
      while (s.heap_len < 2) {
        node = s.heap[++s.heap_len] = max_code < 2 ? ++max_code : 0;
        tree[node * 2] = 1;
        s.depth[node] = 0;
        s.opt_len--;
        if (has_stree) {
          s.static_len -= stree[node * 2 + 1];
        }
      }
      desc.max_code = max_code;
      for (n = s.heap_len >> 1; n >= 1; n--) {
        pqdownheap(s, tree, n);
      }
      node = elems;
      do {
        n = s.heap[
          1
          /*SMALLEST*/
        ];
        s.heap[
          1
          /*SMALLEST*/
        ] = s.heap[s.heap_len--];
        pqdownheap(
          s,
          tree,
          1
          /*SMALLEST*/
        );
        m = s.heap[
          1
          /*SMALLEST*/
        ];
        s.heap[--s.heap_max] = n;
        s.heap[--s.heap_max] = m;
        tree[node * 2] = tree[n * 2] + tree[m * 2];
        s.depth[node] = (s.depth[n] >= s.depth[m] ? s.depth[n] : s.depth[m]) + 1;
        tree[n * 2 + 1] = tree[m * 2 + 1] = node;
        s.heap[
          1
          /*SMALLEST*/
        ] = node++;
        pqdownheap(
          s,
          tree,
          1
          /*SMALLEST*/
        );
      } while (s.heap_len >= 2);
      s.heap[--s.heap_max] = s.heap[
        1
        /*SMALLEST*/
      ];
      gen_bitlen(s, desc);
      gen_codes(tree, max_code, s.bl_count);
    }
    function scan_tree(s, tree, max_code) {
      var n;
      var prevlen = -1;
      var curlen;
      var nextlen = tree[0 * 2 + 1];
      var count = 0;
      var max_count = 7;
      var min_count = 4;
      if (nextlen === 0) {
        max_count = 138;
        min_count = 3;
      }
      tree[(max_code + 1) * 2 + 1] = 65535;
      for (n = 0; n <= max_code; n++) {
        curlen = nextlen;
        nextlen = tree[(n + 1) * 2 + 1];
        if (++count < max_count && curlen === nextlen) {
          continue;
        } else if (count < min_count) {
          s.bl_tree[curlen * 2] += count;
        } else if (curlen !== 0) {
          if (curlen !== prevlen) {
            s.bl_tree[curlen * 2]++;
          }
          s.bl_tree[REP_3_6 * 2]++;
        } else if (count <= 10) {
          s.bl_tree[REPZ_3_10 * 2]++;
        } else {
          s.bl_tree[REPZ_11_138 * 2]++;
        }
        count = 0;
        prevlen = curlen;
        if (nextlen === 0) {
          max_count = 138;
          min_count = 3;
        } else if (curlen === nextlen) {
          max_count = 6;
          min_count = 3;
        } else {
          max_count = 7;
          min_count = 4;
        }
      }
    }
    function send_tree(s, tree, max_code) {
      var n;
      var prevlen = -1;
      var curlen;
      var nextlen = tree[0 * 2 + 1];
      var count = 0;
      var max_count = 7;
      var min_count = 4;
      if (nextlen === 0) {
        max_count = 138;
        min_count = 3;
      }
      for (n = 0; n <= max_code; n++) {
        curlen = nextlen;
        nextlen = tree[(n + 1) * 2 + 1];
        if (++count < max_count && curlen === nextlen) {
          continue;
        } else if (count < min_count) {
          do {
            send_code(s, curlen, s.bl_tree);
          } while (--count !== 0);
        } else if (curlen !== 0) {
          if (curlen !== prevlen) {
            send_code(s, curlen, s.bl_tree);
            count--;
          }
          send_code(s, REP_3_6, s.bl_tree);
          send_bits(s, count - 3, 2);
        } else if (count <= 10) {
          send_code(s, REPZ_3_10, s.bl_tree);
          send_bits(s, count - 3, 3);
        } else {
          send_code(s, REPZ_11_138, s.bl_tree);
          send_bits(s, count - 11, 7);
        }
        count = 0;
        prevlen = curlen;
        if (nextlen === 0) {
          max_count = 138;
          min_count = 3;
        } else if (curlen === nextlen) {
          max_count = 6;
          min_count = 3;
        } else {
          max_count = 7;
          min_count = 4;
        }
      }
    }
    function build_bl_tree(s) {
      var max_blindex;
      scan_tree(s, s.dyn_ltree, s.l_desc.max_code);
      scan_tree(s, s.dyn_dtree, s.d_desc.max_code);
      build_tree(s, s.bl_desc);
      for (max_blindex = BL_CODES - 1; max_blindex >= 3; max_blindex--) {
        if (s.bl_tree[bl_order[max_blindex] * 2 + 1] !== 0) {
          break;
        }
      }
      s.opt_len += 3 * (max_blindex + 1) + 5 + 5 + 4;
      return max_blindex;
    }
    function send_all_trees(s, lcodes, dcodes, blcodes) {
      var rank;
      send_bits(s, lcodes - 257, 5);
      send_bits(s, dcodes - 1, 5);
      send_bits(s, blcodes - 4, 4);
      for (rank = 0; rank < blcodes; rank++) {
        send_bits(s, s.bl_tree[bl_order[rank] * 2 + 1], 3);
      }
      send_tree(s, s.dyn_ltree, lcodes - 1);
      send_tree(s, s.dyn_dtree, dcodes - 1);
    }
    function detect_data_type(s) {
      var black_mask = 4093624447;
      var n;
      for (n = 0; n <= 31; n++, black_mask >>>= 1) {
        if (black_mask & 1 && s.dyn_ltree[n * 2] !== 0) {
          return Z_BINARY;
        }
      }
      if (s.dyn_ltree[9 * 2] !== 0 || s.dyn_ltree[10 * 2] !== 0 || s.dyn_ltree[13 * 2] !== 0) {
        return Z_TEXT;
      }
      for (n = 32; n < LITERALS; n++) {
        if (s.dyn_ltree[n * 2] !== 0) {
          return Z_TEXT;
        }
      }
      return Z_BINARY;
    }
    var static_init_done = false;
    function _tr_init(s) {
      if (!static_init_done) {
        tr_static_init();
        static_init_done = true;
      }
      s.l_desc = new TreeDesc(s.dyn_ltree, static_l_desc);
      s.d_desc = new TreeDesc(s.dyn_dtree, static_d_desc);
      s.bl_desc = new TreeDesc(s.bl_tree, static_bl_desc);
      s.bi_buf = 0;
      s.bi_valid = 0;
      init_block(s);
    }
    function _tr_stored_block(s, buf, stored_len, last) {
      send_bits(s, (STORED_BLOCK << 1) + (last ? 1 : 0), 3);
      copy_block(s, buf, stored_len, true);
    }
    function _tr_align(s) {
      send_bits(s, STATIC_TREES << 1, 3);
      send_code(s, END_BLOCK, static_ltree);
      bi_flush(s);
    }
    function _tr_flush_block(s, buf, stored_len, last) {
      var opt_lenb, static_lenb;
      var max_blindex = 0;
      if (s.level > 0) {
        if (s.strm.data_type === Z_UNKNOWN) {
          s.strm.data_type = detect_data_type(s);
        }
        build_tree(s, s.l_desc);
        build_tree(s, s.d_desc);
        max_blindex = build_bl_tree(s);
        opt_lenb = s.opt_len + 3 + 7 >>> 3;
        static_lenb = s.static_len + 3 + 7 >>> 3;
        if (static_lenb <= opt_lenb) {
          opt_lenb = static_lenb;
        }
      } else {
        opt_lenb = static_lenb = stored_len + 5;
      }
      if (stored_len + 4 <= opt_lenb && buf !== -1) {
        _tr_stored_block(s, buf, stored_len, last);
      } else if (s.strategy === Z_FIXED || static_lenb === opt_lenb) {
        send_bits(s, (STATIC_TREES << 1) + (last ? 1 : 0), 3);
        compress_block(s, static_ltree, static_dtree);
      } else {
        send_bits(s, (DYN_TREES << 1) + (last ? 1 : 0), 3);
        send_all_trees(s, s.l_desc.max_code + 1, s.d_desc.max_code + 1, max_blindex + 1);
        compress_block(s, s.dyn_ltree, s.dyn_dtree);
      }
      init_block(s);
      if (last) {
        bi_windup(s);
      }
    }
    function _tr_tally(s, dist, lc) {
      s.pending_buf[s.d_buf + s.last_lit * 2] = dist >>> 8 & 255;
      s.pending_buf[s.d_buf + s.last_lit * 2 + 1] = dist & 255;
      s.pending_buf[s.l_buf + s.last_lit] = lc & 255;
      s.last_lit++;
      if (dist === 0) {
        s.dyn_ltree[lc * 2]++;
      } else {
        s.matches++;
        dist--;
        s.dyn_ltree[(_length_code[lc] + LITERALS + 1) * 2]++;
        s.dyn_dtree[d_code(dist) * 2]++;
      }
      return s.last_lit === s.lit_bufsize - 1;
    }
    exports._tr_init = _tr_init;
    exports._tr_stored_block = _tr_stored_block;
    exports._tr_flush_block = _tr_flush_block;
    exports._tr_tally = _tr_tally;
    exports._tr_align = _tr_align;
  }
});

// node_modules/pako/lib/zlib/adler32.js
var require_adler32 = __commonJS({
  "node_modules/pako/lib/zlib/adler32.js"(exports, module) {
    "use strict";
    function adler32(adler, buf, len, pos) {
      var s1 = adler & 65535 | 0, s2 = adler >>> 16 & 65535 | 0, n = 0;
      while (len !== 0) {
        n = len > 2e3 ? 2e3 : len;
        len -= n;
        do {
          s1 = s1 + buf[pos++] | 0;
          s2 = s2 + s1 | 0;
        } while (--n);
        s1 %= 65521;
        s2 %= 65521;
      }
      return s1 | s2 << 16 | 0;
    }
    module.exports = adler32;
  }
});

// node_modules/pako/lib/zlib/crc32.js
var require_crc32 = __commonJS({
  "node_modules/pako/lib/zlib/crc32.js"(exports, module) {
    "use strict";
    function makeTable() {
      var c, table = [];
      for (var n = 0; n < 256; n++) {
        c = n;
        for (var k = 0; k < 8; k++) {
          c = c & 1 ? 3988292384 ^ c >>> 1 : c >>> 1;
        }
        table[n] = c;
      }
      return table;
    }
    var crcTable = makeTable();
    function crc32(crc, buf, len, pos) {
      var t = crcTable, end = pos + len;
      crc ^= -1;
      for (var i = pos; i < end; i++) {
        crc = crc >>> 8 ^ t[(crc ^ buf[i]) & 255];
      }
      return crc ^ -1;
    }
    module.exports = crc32;
  }
});

// node_modules/pako/lib/zlib/messages.js
var require_messages = __commonJS({
  "node_modules/pako/lib/zlib/messages.js"(exports, module) {
    "use strict";
    module.exports = {
      2: "need dictionary",
      /* Z_NEED_DICT       2  */
      1: "stream end",
      /* Z_STREAM_END      1  */
      0: "",
      /* Z_OK              0  */
      "-1": "file error",
      /* Z_ERRNO         (-1) */
      "-2": "stream error",
      /* Z_STREAM_ERROR  (-2) */
      "-3": "data error",
      /* Z_DATA_ERROR    (-3) */
      "-4": "insufficient memory",
      /* Z_MEM_ERROR     (-4) */
      "-5": "buffer error",
      /* Z_BUF_ERROR     (-5) */
      "-6": "incompatible version"
      /* Z_VERSION_ERROR (-6) */
    };
  }
});

// node_modules/pako/lib/zlib/deflate.js
var require_deflate = __commonJS({
  "node_modules/pako/lib/zlib/deflate.js"(exports) {
    "use strict";
    var utils = require_common();
    var trees = require_trees();
    var adler32 = require_adler32();
    var crc32 = require_crc32();
    var msg = require_messages();
    var Z_NO_FLUSH = 0;
    var Z_PARTIAL_FLUSH = 1;
    var Z_FULL_FLUSH = 3;
    var Z_FINISH = 4;
    var Z_BLOCK = 5;
    var Z_OK = 0;
    var Z_STREAM_END = 1;
    var Z_STREAM_ERROR = -2;
    var Z_DATA_ERROR = -3;
    var Z_BUF_ERROR = -5;
    var Z_DEFAULT_COMPRESSION = -1;
    var Z_FILTERED = 1;
    var Z_HUFFMAN_ONLY = 2;
    var Z_RLE = 3;
    var Z_FIXED = 4;
    var Z_DEFAULT_STRATEGY = 0;
    var Z_UNKNOWN = 2;
    var Z_DEFLATED = 8;
    var MAX_MEM_LEVEL = 9;
    var MAX_WBITS = 15;
    var DEF_MEM_LEVEL = 8;
    var LENGTH_CODES = 29;
    var LITERALS = 256;
    var L_CODES = LITERALS + 1 + LENGTH_CODES;
    var D_CODES = 30;
    var BL_CODES = 19;
    var HEAP_SIZE = 2 * L_CODES + 1;
    var MAX_BITS = 15;
    var MIN_MATCH = 3;
    var MAX_MATCH = 258;
    var MIN_LOOKAHEAD = MAX_MATCH + MIN_MATCH + 1;
    var PRESET_DICT = 32;
    var INIT_STATE = 42;
    var EXTRA_STATE = 69;
    var NAME_STATE = 73;
    var COMMENT_STATE = 91;
    var HCRC_STATE = 103;
    var BUSY_STATE = 113;
    var FINISH_STATE = 666;
    var BS_NEED_MORE = 1;
    var BS_BLOCK_DONE = 2;
    var BS_FINISH_STARTED = 3;
    var BS_FINISH_DONE = 4;
    var OS_CODE = 3;
    function err(strm, errorCode) {
      strm.msg = msg[errorCode];
      return errorCode;
    }
    function rank(f) {
      return (f << 1) - (f > 4 ? 9 : 0);
    }
    function zero(buf) {
      var len = buf.length;
      while (--len >= 0) {
        buf[len] = 0;
      }
    }
    function flush_pending(strm) {
      var s = strm.state;
      var len = s.pending;
      if (len > strm.avail_out) {
        len = strm.avail_out;
      }
      if (len === 0) {
        return;
      }
      utils.arraySet(strm.output, s.pending_buf, s.pending_out, len, strm.next_out);
      strm.next_out += len;
      s.pending_out += len;
      strm.total_out += len;
      strm.avail_out -= len;
      s.pending -= len;
      if (s.pending === 0) {
        s.pending_out = 0;
      }
    }
    function flush_block_only(s, last) {
      trees._tr_flush_block(s, s.block_start >= 0 ? s.block_start : -1, s.strstart - s.block_start, last);
      s.block_start = s.strstart;
      flush_pending(s.strm);
    }
    function put_byte(s, b) {
      s.pending_buf[s.pending++] = b;
    }
    function putShortMSB(s, b) {
      s.pending_buf[s.pending++] = b >>> 8 & 255;
      s.pending_buf[s.pending++] = b & 255;
    }
    function read_buf(strm, buf, start, size) {
      var len = strm.avail_in;
      if (len > size) {
        len = size;
      }
      if (len === 0) {
        return 0;
      }
      strm.avail_in -= len;
      utils.arraySet(buf, strm.input, strm.next_in, len, start);
      if (strm.state.wrap === 1) {
        strm.adler = adler32(strm.adler, buf, len, start);
      } else if (strm.state.wrap === 2) {
        strm.adler = crc32(strm.adler, buf, len, start);
      }
      strm.next_in += len;
      strm.total_in += len;
      return len;
    }
    function longest_match(s, cur_match) {
      var chain_length = s.max_chain_length;
      var scan = s.strstart;
      var match;
      var len;
      var best_len = s.prev_length;
      var nice_match = s.nice_match;
      var limit = s.strstart > s.w_size - MIN_LOOKAHEAD ? s.strstart - (s.w_size - MIN_LOOKAHEAD) : 0;
      var _win = s.window;
      var wmask = s.w_mask;
      var prev = s.prev;
      var strend = s.strstart + MAX_MATCH;
      var scan_end1 = _win[scan + best_len - 1];
      var scan_end = _win[scan + best_len];
      if (s.prev_length >= s.good_match) {
        chain_length >>= 2;
      }
      if (nice_match > s.lookahead) {
        nice_match = s.lookahead;
      }
      do {
        match = cur_match;
        if (_win[match + best_len] !== scan_end || _win[match + best_len - 1] !== scan_end1 || _win[match] !== _win[scan] || _win[++match] !== _win[scan + 1]) {
          continue;
        }
        scan += 2;
        match++;
        do {
        } while (_win[++scan] === _win[++match] && _win[++scan] === _win[++match] && _win[++scan] === _win[++match] && _win[++scan] === _win[++match] && _win[++scan] === _win[++match] && _win[++scan] === _win[++match] && _win[++scan] === _win[++match] && _win[++scan] === _win[++match] && scan < strend);
        len = MAX_MATCH - (strend - scan);
        scan = strend - MAX_MATCH;
        if (len > best_len) {
          s.match_start = cur_match;
          best_len = len;
          if (len >= nice_match) {
            break;
          }
          scan_end1 = _win[scan + best_len - 1];
          scan_end = _win[scan + best_len];
        }
      } while ((cur_match = prev[cur_match & wmask]) > limit && --chain_length !== 0);
      if (best_len <= s.lookahead) {
        return best_len;
      }
      return s.lookahead;
    }
    function fill_window(s) {
      var _w_size = s.w_size;
      var p, n, m, more, str;
      do {
        more = s.window_size - s.lookahead - s.strstart;
        if (s.strstart >= _w_size + (_w_size - MIN_LOOKAHEAD)) {
          utils.arraySet(s.window, s.window, _w_size, _w_size, 0);
          s.match_start -= _w_size;
          s.strstart -= _w_size;
          s.block_start -= _w_size;
          n = s.hash_size;
          p = n;
          do {
            m = s.head[--p];
            s.head[p] = m >= _w_size ? m - _w_size : 0;
          } while (--n);
          n = _w_size;
          p = n;
          do {
            m = s.prev[--p];
            s.prev[p] = m >= _w_size ? m - _w_size : 0;
          } while (--n);
          more += _w_size;
        }
        if (s.strm.avail_in === 0) {
          break;
        }
        n = read_buf(s.strm, s.window, s.strstart + s.lookahead, more);
        s.lookahead += n;
        if (s.lookahead + s.insert >= MIN_MATCH) {
          str = s.strstart - s.insert;
          s.ins_h = s.window[str];
          s.ins_h = (s.ins_h << s.hash_shift ^ s.window[str + 1]) & s.hash_mask;
          while (s.insert) {
            s.ins_h = (s.ins_h << s.hash_shift ^ s.window[str + MIN_MATCH - 1]) & s.hash_mask;
            s.prev[str & s.w_mask] = s.head[s.ins_h];
            s.head[s.ins_h] = str;
            str++;
            s.insert--;
            if (s.lookahead + s.insert < MIN_MATCH) {
              break;
            }
          }
        }
      } while (s.lookahead < MIN_LOOKAHEAD && s.strm.avail_in !== 0);
    }
    function deflate_stored(s, flush) {
      var max_block_size = 65535;
      if (max_block_size > s.pending_buf_size - 5) {
        max_block_size = s.pending_buf_size - 5;
      }
      for (; ; ) {
        if (s.lookahead <= 1) {
          fill_window(s);
          if (s.lookahead === 0 && flush === Z_NO_FLUSH) {
            return BS_NEED_MORE;
          }
          if (s.lookahead === 0) {
            break;
          }
        }
        s.strstart += s.lookahead;
        s.lookahead = 0;
        var max_start = s.block_start + max_block_size;
        if (s.strstart === 0 || s.strstart >= max_start) {
          s.lookahead = s.strstart - max_start;
          s.strstart = max_start;
          flush_block_only(s, false);
          if (s.strm.avail_out === 0) {
            return BS_NEED_MORE;
          }
        }
        if (s.strstart - s.block_start >= s.w_size - MIN_LOOKAHEAD) {
          flush_block_only(s, false);
          if (s.strm.avail_out === 0) {
            return BS_NEED_MORE;
          }
        }
      }
      s.insert = 0;
      if (flush === Z_FINISH) {
        flush_block_only(s, true);
        if (s.strm.avail_out === 0) {
          return BS_FINISH_STARTED;
        }
        return BS_FINISH_DONE;
      }
      if (s.strstart > s.block_start) {
        flush_block_only(s, false);
        if (s.strm.avail_out === 0) {
          return BS_NEED_MORE;
        }
      }
      return BS_NEED_MORE;
    }
    function deflate_fast(s, flush) {
      var hash_head;
      var bflush;
      for (; ; ) {
        if (s.lookahead < MIN_LOOKAHEAD) {
          fill_window(s);
          if (s.lookahead < MIN_LOOKAHEAD && flush === Z_NO_FLUSH) {
            return BS_NEED_MORE;
          }
          if (s.lookahead === 0) {
            break;
          }
        }
        hash_head = 0;
        if (s.lookahead >= MIN_MATCH) {
          s.ins_h = (s.ins_h << s.hash_shift ^ s.window[s.strstart + MIN_MATCH - 1]) & s.hash_mask;
          hash_head = s.prev[s.strstart & s.w_mask] = s.head[s.ins_h];
          s.head[s.ins_h] = s.strstart;
        }
        if (hash_head !== 0 && s.strstart - hash_head <= s.w_size - MIN_LOOKAHEAD) {
          s.match_length = longest_match(s, hash_head);
        }
        if (s.match_length >= MIN_MATCH) {
          bflush = trees._tr_tally(s, s.strstart - s.match_start, s.match_length - MIN_MATCH);
          s.lookahead -= s.match_length;
          if (s.match_length <= s.max_lazy_match && s.lookahead >= MIN_MATCH) {
            s.match_length--;
            do {
              s.strstart++;
              s.ins_h = (s.ins_h << s.hash_shift ^ s.window[s.strstart + MIN_MATCH - 1]) & s.hash_mask;
              hash_head = s.prev[s.strstart & s.w_mask] = s.head[s.ins_h];
              s.head[s.ins_h] = s.strstart;
            } while (--s.match_length !== 0);
            s.strstart++;
          } else {
            s.strstart += s.match_length;
            s.match_length = 0;
            s.ins_h = s.window[s.strstart];
            s.ins_h = (s.ins_h << s.hash_shift ^ s.window[s.strstart + 1]) & s.hash_mask;
          }
        } else {
          bflush = trees._tr_tally(s, 0, s.window[s.strstart]);
          s.lookahead--;
          s.strstart++;
        }
        if (bflush) {
          flush_block_only(s, false);
          if (s.strm.avail_out === 0) {
            return BS_NEED_MORE;
          }
        }
      }
      s.insert = s.strstart < MIN_MATCH - 1 ? s.strstart : MIN_MATCH - 1;
      if (flush === Z_FINISH) {
        flush_block_only(s, true);
        if (s.strm.avail_out === 0) {
          return BS_FINISH_STARTED;
        }
        return BS_FINISH_DONE;
      }
      if (s.last_lit) {
        flush_block_only(s, false);
        if (s.strm.avail_out === 0) {
          return BS_NEED_MORE;
        }
      }
      return BS_BLOCK_DONE;
    }
    function deflate_slow(s, flush) {
      var hash_head;
      var bflush;
      var max_insert;
      for (; ; ) {
        if (s.lookahead < MIN_LOOKAHEAD) {
          fill_window(s);
          if (s.lookahead < MIN_LOOKAHEAD && flush === Z_NO_FLUSH) {
            return BS_NEED_MORE;
          }
          if (s.lookahead === 0) {
            break;
          }
        }
        hash_head = 0;
        if (s.lookahead >= MIN_MATCH) {
          s.ins_h = (s.ins_h << s.hash_shift ^ s.window[s.strstart + MIN_MATCH - 1]) & s.hash_mask;
          hash_head = s.prev[s.strstart & s.w_mask] = s.head[s.ins_h];
          s.head[s.ins_h] = s.strstart;
        }
        s.prev_length = s.match_length;
        s.prev_match = s.match_start;
        s.match_length = MIN_MATCH - 1;
        if (hash_head !== 0 && s.prev_length < s.max_lazy_match && s.strstart - hash_head <= s.w_size - MIN_LOOKAHEAD) {
          s.match_length = longest_match(s, hash_head);
          if (s.match_length <= 5 && (s.strategy === Z_FILTERED || s.match_length === MIN_MATCH && s.strstart - s.match_start > 4096)) {
            s.match_length = MIN_MATCH - 1;
          }
        }
        if (s.prev_length >= MIN_MATCH && s.match_length <= s.prev_length) {
          max_insert = s.strstart + s.lookahead - MIN_MATCH;
          bflush = trees._tr_tally(s, s.strstart - 1 - s.prev_match, s.prev_length - MIN_MATCH);
          s.lookahead -= s.prev_length - 1;
          s.prev_length -= 2;
          do {
            if (++s.strstart <= max_insert) {
              s.ins_h = (s.ins_h << s.hash_shift ^ s.window[s.strstart + MIN_MATCH - 1]) & s.hash_mask;
              hash_head = s.prev[s.strstart & s.w_mask] = s.head[s.ins_h];
              s.head[s.ins_h] = s.strstart;
            }
          } while (--s.prev_length !== 0);
          s.match_available = 0;
          s.match_length = MIN_MATCH - 1;
          s.strstart++;
          if (bflush) {
            flush_block_only(s, false);
            if (s.strm.avail_out === 0) {
              return BS_NEED_MORE;
            }
          }
        } else if (s.match_available) {
          bflush = trees._tr_tally(s, 0, s.window[s.strstart - 1]);
          if (bflush) {
            flush_block_only(s, false);
          }
          s.strstart++;
          s.lookahead--;
          if (s.strm.avail_out === 0) {
            return BS_NEED_MORE;
          }
        } else {
          s.match_available = 1;
          s.strstart++;
          s.lookahead--;
        }
      }
      if (s.match_available) {
        bflush = trees._tr_tally(s, 0, s.window[s.strstart - 1]);
        s.match_available = 0;
      }
      s.insert = s.strstart < MIN_MATCH - 1 ? s.strstart : MIN_MATCH - 1;
      if (flush === Z_FINISH) {
        flush_block_only(s, true);
        if (s.strm.avail_out === 0) {
          return BS_FINISH_STARTED;
        }
        return BS_FINISH_DONE;
      }
      if (s.last_lit) {
        flush_block_only(s, false);
        if (s.strm.avail_out === 0) {
          return BS_NEED_MORE;
        }
      }
      return BS_BLOCK_DONE;
    }
    function deflate_rle(s, flush) {
      var bflush;
      var prev;
      var scan, strend;
      var _win = s.window;
      for (; ; ) {
        if (s.lookahead <= MAX_MATCH) {
          fill_window(s);
          if (s.lookahead <= MAX_MATCH && flush === Z_NO_FLUSH) {
            return BS_NEED_MORE;
          }
          if (s.lookahead === 0) {
            break;
          }
        }
        s.match_length = 0;
        if (s.lookahead >= MIN_MATCH && s.strstart > 0) {
          scan = s.strstart - 1;
          prev = _win[scan];
          if (prev === _win[++scan] && prev === _win[++scan] && prev === _win[++scan]) {
            strend = s.strstart + MAX_MATCH;
            do {
            } while (prev === _win[++scan] && prev === _win[++scan] && prev === _win[++scan] && prev === _win[++scan] && prev === _win[++scan] && prev === _win[++scan] && prev === _win[++scan] && prev === _win[++scan] && scan < strend);
            s.match_length = MAX_MATCH - (strend - scan);
            if (s.match_length > s.lookahead) {
              s.match_length = s.lookahead;
            }
          }
        }
        if (s.match_length >= MIN_MATCH) {
          bflush = trees._tr_tally(s, 1, s.match_length - MIN_MATCH);
          s.lookahead -= s.match_length;
          s.strstart += s.match_length;
          s.match_length = 0;
        } else {
          bflush = trees._tr_tally(s, 0, s.window[s.strstart]);
          s.lookahead--;
          s.strstart++;
        }
        if (bflush) {
          flush_block_only(s, false);
          if (s.strm.avail_out === 0) {
            return BS_NEED_MORE;
          }
        }
      }
      s.insert = 0;
      if (flush === Z_FINISH) {
        flush_block_only(s, true);
        if (s.strm.avail_out === 0) {
          return BS_FINISH_STARTED;
        }
        return BS_FINISH_DONE;
      }
      if (s.last_lit) {
        flush_block_only(s, false);
        if (s.strm.avail_out === 0) {
          return BS_NEED_MORE;
        }
      }
      return BS_BLOCK_DONE;
    }
    function deflate_huff(s, flush) {
      var bflush;
      for (; ; ) {
        if (s.lookahead === 0) {
          fill_window(s);
          if (s.lookahead === 0) {
            if (flush === Z_NO_FLUSH) {
              return BS_NEED_MORE;
            }
            break;
          }
        }
        s.match_length = 0;
        bflush = trees._tr_tally(s, 0, s.window[s.strstart]);
        s.lookahead--;
        s.strstart++;
        if (bflush) {
          flush_block_only(s, false);
          if (s.strm.avail_out === 0) {
            return BS_NEED_MORE;
          }
        }
      }
      s.insert = 0;
      if (flush === Z_FINISH) {
        flush_block_only(s, true);
        if (s.strm.avail_out === 0) {
          return BS_FINISH_STARTED;
        }
        return BS_FINISH_DONE;
      }
      if (s.last_lit) {
        flush_block_only(s, false);
        if (s.strm.avail_out === 0) {
          return BS_NEED_MORE;
        }
      }
      return BS_BLOCK_DONE;
    }
    function Config(good_length, max_lazy, nice_length, max_chain, func) {
      this.good_length = good_length;
      this.max_lazy = max_lazy;
      this.nice_length = nice_length;
      this.max_chain = max_chain;
      this.func = func;
    }
    var configuration_table;
    configuration_table = [
      /*      good lazy nice chain */
      new Config(0, 0, 0, 0, deflate_stored),
      /* 0 store only */
      new Config(4, 4, 8, 4, deflate_fast),
      /* 1 max speed, no lazy matches */
      new Config(4, 5, 16, 8, deflate_fast),
      /* 2 */
      new Config(4, 6, 32, 32, deflate_fast),
      /* 3 */
      new Config(4, 4, 16, 16, deflate_slow),
      /* 4 lazy matches */
      new Config(8, 16, 32, 32, deflate_slow),
      /* 5 */
      new Config(8, 16, 128, 128, deflate_slow),
      /* 6 */
      new Config(8, 32, 128, 256, deflate_slow),
      /* 7 */
      new Config(32, 128, 258, 1024, deflate_slow),
      /* 8 */
      new Config(32, 258, 258, 4096, deflate_slow)
      /* 9 max compression */
    ];
    function lm_init(s) {
      s.window_size = 2 * s.w_size;
      zero(s.head);
      s.max_lazy_match = configuration_table[s.level].max_lazy;
      s.good_match = configuration_table[s.level].good_length;
      s.nice_match = configuration_table[s.level].nice_length;
      s.max_chain_length = configuration_table[s.level].max_chain;
      s.strstart = 0;
      s.block_start = 0;
      s.lookahead = 0;
      s.insert = 0;
      s.match_length = s.prev_length = MIN_MATCH - 1;
      s.match_available = 0;
      s.ins_h = 0;
    }
    function DeflateState() {
      this.strm = null;
      this.status = 0;
      this.pending_buf = null;
      this.pending_buf_size = 0;
      this.pending_out = 0;
      this.pending = 0;
      this.wrap = 0;
      this.gzhead = null;
      this.gzindex = 0;
      this.method = Z_DEFLATED;
      this.last_flush = -1;
      this.w_size = 0;
      this.w_bits = 0;
      this.w_mask = 0;
      this.window = null;
      this.window_size = 0;
      this.prev = null;
      this.head = null;
      this.ins_h = 0;
      this.hash_size = 0;
      this.hash_bits = 0;
      this.hash_mask = 0;
      this.hash_shift = 0;
      this.block_start = 0;
      this.match_length = 0;
      this.prev_match = 0;
      this.match_available = 0;
      this.strstart = 0;
      this.match_start = 0;
      this.lookahead = 0;
      this.prev_length = 0;
      this.max_chain_length = 0;
      this.max_lazy_match = 0;
      this.level = 0;
      this.strategy = 0;
      this.good_match = 0;
      this.nice_match = 0;
      this.dyn_ltree = new utils.Buf16(HEAP_SIZE * 2);
      this.dyn_dtree = new utils.Buf16((2 * D_CODES + 1) * 2);
      this.bl_tree = new utils.Buf16((2 * BL_CODES + 1) * 2);
      zero(this.dyn_ltree);
      zero(this.dyn_dtree);
      zero(this.bl_tree);
      this.l_desc = null;
      this.d_desc = null;
      this.bl_desc = null;
      this.bl_count = new utils.Buf16(MAX_BITS + 1);
      this.heap = new utils.Buf16(2 * L_CODES + 1);
      zero(this.heap);
      this.heap_len = 0;
      this.heap_max = 0;
      this.depth = new utils.Buf16(2 * L_CODES + 1);
      zero(this.depth);
      this.l_buf = 0;
      this.lit_bufsize = 0;
      this.last_lit = 0;
      this.d_buf = 0;
      this.opt_len = 0;
      this.static_len = 0;
      this.matches = 0;
      this.insert = 0;
      this.bi_buf = 0;
      this.bi_valid = 0;
    }
    function deflateResetKeep(strm) {
      var s;
      if (!strm || !strm.state) {
        return err(strm, Z_STREAM_ERROR);
      }
      strm.total_in = strm.total_out = 0;
      strm.data_type = Z_UNKNOWN;
      s = strm.state;
      s.pending = 0;
      s.pending_out = 0;
      if (s.wrap < 0) {
        s.wrap = -s.wrap;
      }
      s.status = s.wrap ? INIT_STATE : BUSY_STATE;
      strm.adler = s.wrap === 2 ? 0 : 1;
      s.last_flush = Z_NO_FLUSH;
      trees._tr_init(s);
      return Z_OK;
    }
    function deflateReset(strm) {
      var ret = deflateResetKeep(strm);
      if (ret === Z_OK) {
        lm_init(strm.state);
      }
      return ret;
    }
    function deflateSetHeader(strm, head) {
      if (!strm || !strm.state) {
        return Z_STREAM_ERROR;
      }
      if (strm.state.wrap !== 2) {
        return Z_STREAM_ERROR;
      }
      strm.state.gzhead = head;
      return Z_OK;
    }
    function deflateInit2(strm, level, method, windowBits, memLevel, strategy) {
      if (!strm) {
        return Z_STREAM_ERROR;
      }
      var wrap = 1;
      if (level === Z_DEFAULT_COMPRESSION) {
        level = 6;
      }
      if (windowBits < 0) {
        wrap = 0;
        windowBits = -windowBits;
      } else if (windowBits > 15) {
        wrap = 2;
        windowBits -= 16;
      }
      if (memLevel < 1 || memLevel > MAX_MEM_LEVEL || method !== Z_DEFLATED || windowBits < 8 || windowBits > 15 || level < 0 || level > 9 || strategy < 0 || strategy > Z_FIXED) {
        return err(strm, Z_STREAM_ERROR);
      }
      if (windowBits === 8) {
        windowBits = 9;
      }
      var s = new DeflateState();
      strm.state = s;
      s.strm = strm;
      s.wrap = wrap;
      s.gzhead = null;
      s.w_bits = windowBits;
      s.w_size = 1 << s.w_bits;
      s.w_mask = s.w_size - 1;
      s.hash_bits = memLevel + 7;
      s.hash_size = 1 << s.hash_bits;
      s.hash_mask = s.hash_size - 1;
      s.hash_shift = ~~((s.hash_bits + MIN_MATCH - 1) / MIN_MATCH);
      s.window = new utils.Buf8(s.w_size * 2);
      s.head = new utils.Buf16(s.hash_size);
      s.prev = new utils.Buf16(s.w_size);
      s.lit_bufsize = 1 << memLevel + 6;
      s.pending_buf_size = s.lit_bufsize * 4;
      s.pending_buf = new utils.Buf8(s.pending_buf_size);
      s.d_buf = 1 * s.lit_bufsize;
      s.l_buf = (1 + 2) * s.lit_bufsize;
      s.level = level;
      s.strategy = strategy;
      s.method = method;
      return deflateReset(strm);
    }
    function deflateInit(strm, level) {
      return deflateInit2(strm, level, Z_DEFLATED, MAX_WBITS, DEF_MEM_LEVEL, Z_DEFAULT_STRATEGY);
    }
    function deflate(strm, flush) {
      var old_flush, s;
      var beg, val;
      if (!strm || !strm.state || flush > Z_BLOCK || flush < 0) {
        return strm ? err(strm, Z_STREAM_ERROR) : Z_STREAM_ERROR;
      }
      s = strm.state;
      if (!strm.output || !strm.input && strm.avail_in !== 0 || s.status === FINISH_STATE && flush !== Z_FINISH) {
        return err(strm, strm.avail_out === 0 ? Z_BUF_ERROR : Z_STREAM_ERROR);
      }
      s.strm = strm;
      old_flush = s.last_flush;
      s.last_flush = flush;
      if (s.status === INIT_STATE) {
        if (s.wrap === 2) {
          strm.adler = 0;
          put_byte(s, 31);
          put_byte(s, 139);
          put_byte(s, 8);
          if (!s.gzhead) {
            put_byte(s, 0);
            put_byte(s, 0);
            put_byte(s, 0);
            put_byte(s, 0);
            put_byte(s, 0);
            put_byte(s, s.level === 9 ? 2 : s.strategy >= Z_HUFFMAN_ONLY || s.level < 2 ? 4 : 0);
            put_byte(s, OS_CODE);
            s.status = BUSY_STATE;
          } else {
            put_byte(
              s,
              (s.gzhead.text ? 1 : 0) + (s.gzhead.hcrc ? 2 : 0) + (!s.gzhead.extra ? 0 : 4) + (!s.gzhead.name ? 0 : 8) + (!s.gzhead.comment ? 0 : 16)
            );
            put_byte(s, s.gzhead.time & 255);
            put_byte(s, s.gzhead.time >> 8 & 255);
            put_byte(s, s.gzhead.time >> 16 & 255);
            put_byte(s, s.gzhead.time >> 24 & 255);
            put_byte(s, s.level === 9 ? 2 : s.strategy >= Z_HUFFMAN_ONLY || s.level < 2 ? 4 : 0);
            put_byte(s, s.gzhead.os & 255);
            if (s.gzhead.extra && s.gzhead.extra.length) {
              put_byte(s, s.gzhead.extra.length & 255);
              put_byte(s, s.gzhead.extra.length >> 8 & 255);
            }
            if (s.gzhead.hcrc) {
              strm.adler = crc32(strm.adler, s.pending_buf, s.pending, 0);
            }
            s.gzindex = 0;
            s.status = EXTRA_STATE;
          }
        } else {
          var header = Z_DEFLATED + (s.w_bits - 8 << 4) << 8;
          var level_flags = -1;
          if (s.strategy >= Z_HUFFMAN_ONLY || s.level < 2) {
            level_flags = 0;
          } else if (s.level < 6) {
            level_flags = 1;
          } else if (s.level === 6) {
            level_flags = 2;
          } else {
            level_flags = 3;
          }
          header |= level_flags << 6;
          if (s.strstart !== 0) {
            header |= PRESET_DICT;
          }
          header += 31 - header % 31;
          s.status = BUSY_STATE;
          putShortMSB(s, header);
          if (s.strstart !== 0) {
            putShortMSB(s, strm.adler >>> 16);
            putShortMSB(s, strm.adler & 65535);
          }
          strm.adler = 1;
        }
      }
      if (s.status === EXTRA_STATE) {
        if (s.gzhead.extra) {
          beg = s.pending;
          while (s.gzindex < (s.gzhead.extra.length & 65535)) {
            if (s.pending === s.pending_buf_size) {
              if (s.gzhead.hcrc && s.pending > beg) {
                strm.adler = crc32(strm.adler, s.pending_buf, s.pending - beg, beg);
              }
              flush_pending(strm);
              beg = s.pending;
              if (s.pending === s.pending_buf_size) {
                break;
              }
            }
            put_byte(s, s.gzhead.extra[s.gzindex] & 255);
            s.gzindex++;
          }
          if (s.gzhead.hcrc && s.pending > beg) {
            strm.adler = crc32(strm.adler, s.pending_buf, s.pending - beg, beg);
          }
          if (s.gzindex === s.gzhead.extra.length) {
            s.gzindex = 0;
            s.status = NAME_STATE;
          }
        } else {
          s.status = NAME_STATE;
        }
      }
      if (s.status === NAME_STATE) {
        if (s.gzhead.name) {
          beg = s.pending;
          do {
            if (s.pending === s.pending_buf_size) {
              if (s.gzhead.hcrc && s.pending > beg) {
                strm.adler = crc32(strm.adler, s.pending_buf, s.pending - beg, beg);
              }
              flush_pending(strm);
              beg = s.pending;
              if (s.pending === s.pending_buf_size) {
                val = 1;
                break;
              }
            }
            if (s.gzindex < s.gzhead.name.length) {
              val = s.gzhead.name.charCodeAt(s.gzindex++) & 255;
            } else {
              val = 0;
            }
            put_byte(s, val);
          } while (val !== 0);
          if (s.gzhead.hcrc && s.pending > beg) {
            strm.adler = crc32(strm.adler, s.pending_buf, s.pending - beg, beg);
          }
          if (val === 0) {
            s.gzindex = 0;
            s.status = COMMENT_STATE;
          }
        } else {
          s.status = COMMENT_STATE;
        }
      }
      if (s.status === COMMENT_STATE) {
        if (s.gzhead.comment) {
          beg = s.pending;
          do {
            if (s.pending === s.pending_buf_size) {
              if (s.gzhead.hcrc && s.pending > beg) {
                strm.adler = crc32(strm.adler, s.pending_buf, s.pending - beg, beg);
              }
              flush_pending(strm);
              beg = s.pending;
              if (s.pending === s.pending_buf_size) {
                val = 1;
                break;
              }
            }
            if (s.gzindex < s.gzhead.comment.length) {
              val = s.gzhead.comment.charCodeAt(s.gzindex++) & 255;
            } else {
              val = 0;
            }
            put_byte(s, val);
          } while (val !== 0);
          if (s.gzhead.hcrc && s.pending > beg) {
            strm.adler = crc32(strm.adler, s.pending_buf, s.pending - beg, beg);
          }
          if (val === 0) {
            s.status = HCRC_STATE;
          }
        } else {
          s.status = HCRC_STATE;
        }
      }
      if (s.status === HCRC_STATE) {
        if (s.gzhead.hcrc) {
          if (s.pending + 2 > s.pending_buf_size) {
            flush_pending(strm);
          }
          if (s.pending + 2 <= s.pending_buf_size) {
            put_byte(s, strm.adler & 255);
            put_byte(s, strm.adler >> 8 & 255);
            strm.adler = 0;
            s.status = BUSY_STATE;
          }
        } else {
          s.status = BUSY_STATE;
        }
      }
      if (s.pending !== 0) {
        flush_pending(strm);
        if (strm.avail_out === 0) {
          s.last_flush = -1;
          return Z_OK;
        }
      } else if (strm.avail_in === 0 && rank(flush) <= rank(old_flush) && flush !== Z_FINISH) {
        return err(strm, Z_BUF_ERROR);
      }
      if (s.status === FINISH_STATE && strm.avail_in !== 0) {
        return err(strm, Z_BUF_ERROR);
      }
      if (strm.avail_in !== 0 || s.lookahead !== 0 || flush !== Z_NO_FLUSH && s.status !== FINISH_STATE) {
        var bstate = s.strategy === Z_HUFFMAN_ONLY ? deflate_huff(s, flush) : s.strategy === Z_RLE ? deflate_rle(s, flush) : configuration_table[s.level].func(s, flush);
        if (bstate === BS_FINISH_STARTED || bstate === BS_FINISH_DONE) {
          s.status = FINISH_STATE;
        }
        if (bstate === BS_NEED_MORE || bstate === BS_FINISH_STARTED) {
          if (strm.avail_out === 0) {
            s.last_flush = -1;
          }
          return Z_OK;
        }
        if (bstate === BS_BLOCK_DONE) {
          if (flush === Z_PARTIAL_FLUSH) {
            trees._tr_align(s);
          } else if (flush !== Z_BLOCK) {
            trees._tr_stored_block(s, 0, 0, false);
            if (flush === Z_FULL_FLUSH) {
              zero(s.head);
              if (s.lookahead === 0) {
                s.strstart = 0;
                s.block_start = 0;
                s.insert = 0;
              }
            }
          }
          flush_pending(strm);
          if (strm.avail_out === 0) {
            s.last_flush = -1;
            return Z_OK;
          }
        }
      }
      if (flush !== Z_FINISH) {
        return Z_OK;
      }
      if (s.wrap <= 0) {
        return Z_STREAM_END;
      }
      if (s.wrap === 2) {
        put_byte(s, strm.adler & 255);
        put_byte(s, strm.adler >> 8 & 255);
        put_byte(s, strm.adler >> 16 & 255);
        put_byte(s, strm.adler >> 24 & 255);
        put_byte(s, strm.total_in & 255);
        put_byte(s, strm.total_in >> 8 & 255);
        put_byte(s, strm.total_in >> 16 & 255);
        put_byte(s, strm.total_in >> 24 & 255);
      } else {
        putShortMSB(s, strm.adler >>> 16);
        putShortMSB(s, strm.adler & 65535);
      }
      flush_pending(strm);
      if (s.wrap > 0) {
        s.wrap = -s.wrap;
      }
      return s.pending !== 0 ? Z_OK : Z_STREAM_END;
    }
    function deflateEnd(strm) {
      var status;
      if (!strm || !strm.state) {
        return Z_STREAM_ERROR;
      }
      status = strm.state.status;
      if (status !== INIT_STATE && status !== EXTRA_STATE && status !== NAME_STATE && status !== COMMENT_STATE && status !== HCRC_STATE && status !== BUSY_STATE && status !== FINISH_STATE) {
        return err(strm, Z_STREAM_ERROR);
      }
      strm.state = null;
      return status === BUSY_STATE ? err(strm, Z_DATA_ERROR) : Z_OK;
    }
    function deflateSetDictionary(strm, dictionary) {
      var dictLength = dictionary.length;
      var s;
      var str, n;
      var wrap;
      var avail;
      var next;
      var input;
      var tmpDict;
      if (!strm || !strm.state) {
        return Z_STREAM_ERROR;
      }
      s = strm.state;
      wrap = s.wrap;
      if (wrap === 2 || wrap === 1 && s.status !== INIT_STATE || s.lookahead) {
        return Z_STREAM_ERROR;
      }
      if (wrap === 1) {
        strm.adler = adler32(strm.adler, dictionary, dictLength, 0);
      }
      s.wrap = 0;
      if (dictLength >= s.w_size) {
        if (wrap === 0) {
          zero(s.head);
          s.strstart = 0;
          s.block_start = 0;
          s.insert = 0;
        }
        tmpDict = new utils.Buf8(s.w_size);
        utils.arraySet(tmpDict, dictionary, dictLength - s.w_size, s.w_size, 0);
        dictionary = tmpDict;
        dictLength = s.w_size;
      }
      avail = strm.avail_in;
      next = strm.next_in;
      input = strm.input;
      strm.avail_in = dictLength;
      strm.next_in = 0;
      strm.input = dictionary;
      fill_window(s);
      while (s.lookahead >= MIN_MATCH) {
        str = s.strstart;
        n = s.lookahead - (MIN_MATCH - 1);
        do {
          s.ins_h = (s.ins_h << s.hash_shift ^ s.window[str + MIN_MATCH - 1]) & s.hash_mask;
          s.prev[str & s.w_mask] = s.head[s.ins_h];
          s.head[s.ins_h] = str;
          str++;
        } while (--n);
        s.strstart = str;
        s.lookahead = MIN_MATCH - 1;
        fill_window(s);
      }
      s.strstart += s.lookahead;
      s.block_start = s.strstart;
      s.insert = s.lookahead;
      s.lookahead = 0;
      s.match_length = s.prev_length = MIN_MATCH - 1;
      s.match_available = 0;
      strm.next_in = next;
      strm.input = input;
      strm.avail_in = avail;
      s.wrap = wrap;
      return Z_OK;
    }
    exports.deflateInit = deflateInit;
    exports.deflateInit2 = deflateInit2;
    exports.deflateReset = deflateReset;
    exports.deflateResetKeep = deflateResetKeep;
    exports.deflateSetHeader = deflateSetHeader;
    exports.deflate = deflate;
    exports.deflateEnd = deflateEnd;
    exports.deflateSetDictionary = deflateSetDictionary;
    exports.deflateInfo = "pako deflate (from Nodeca project)";
  }
});

// node_modules/pako/lib/utils/strings.js
var require_strings = __commonJS({
  "node_modules/pako/lib/utils/strings.js"(exports) {
    "use strict";
    var utils = require_common();
    var STR_APPLY_OK = true;
    var STR_APPLY_UIA_OK = true;
    try {
      String.fromCharCode.apply(null, [0]);
    } catch (__) {
      STR_APPLY_OK = false;
    }
    try {
      String.fromCharCode.apply(null, new Uint8Array(1));
    } catch (__) {
      STR_APPLY_UIA_OK = false;
    }
    var _utf8len = new utils.Buf8(256);
    for (q = 0; q < 256; q++) {
      _utf8len[q] = q >= 252 ? 6 : q >= 248 ? 5 : q >= 240 ? 4 : q >= 224 ? 3 : q >= 192 ? 2 : 1;
    }
    var q;
    _utf8len[254] = _utf8len[254] = 1;
    exports.string2buf = function(str) {
      var buf, c, c2, m_pos, i, str_len = str.length, buf_len = 0;
      for (m_pos = 0; m_pos < str_len; m_pos++) {
        c = str.charCodeAt(m_pos);
        if ((c & 64512) === 55296 && m_pos + 1 < str_len) {
          c2 = str.charCodeAt(m_pos + 1);
          if ((c2 & 64512) === 56320) {
            c = 65536 + (c - 55296 << 10) + (c2 - 56320);
            m_pos++;
          }
        }
        buf_len += c < 128 ? 1 : c < 2048 ? 2 : c < 65536 ? 3 : 4;
      }
      buf = new utils.Buf8(buf_len);
      for (i = 0, m_pos = 0; i < buf_len; m_pos++) {
        c = str.charCodeAt(m_pos);
        if ((c & 64512) === 55296 && m_pos + 1 < str_len) {
          c2 = str.charCodeAt(m_pos + 1);
          if ((c2 & 64512) === 56320) {
            c = 65536 + (c - 55296 << 10) + (c2 - 56320);
            m_pos++;
          }
        }
        if (c < 128) {
          buf[i++] = c;
        } else if (c < 2048) {
          buf[i++] = 192 | c >>> 6;
          buf[i++] = 128 | c & 63;
        } else if (c < 65536) {
          buf[i++] = 224 | c >>> 12;
          buf[i++] = 128 | c >>> 6 & 63;
          buf[i++] = 128 | c & 63;
        } else {
          buf[i++] = 240 | c >>> 18;
          buf[i++] = 128 | c >>> 12 & 63;
          buf[i++] = 128 | c >>> 6 & 63;
          buf[i++] = 128 | c & 63;
        }
      }
      return buf;
    };
    function buf2binstring(buf, len) {
      if (len < 65534) {
        if (buf.subarray && STR_APPLY_UIA_OK || !buf.subarray && STR_APPLY_OK) {
          return String.fromCharCode.apply(null, utils.shrinkBuf(buf, len));
        }
      }
      var result = "";
      for (var i = 0; i < len; i++) {
        result += String.fromCharCode(buf[i]);
      }
      return result;
    }
    exports.buf2binstring = function(buf) {
      return buf2binstring(buf, buf.length);
    };
    exports.binstring2buf = function(str) {
      var buf = new utils.Buf8(str.length);
      for (var i = 0, len = buf.length; i < len; i++) {
        buf[i] = str.charCodeAt(i);
      }
      return buf;
    };
    exports.buf2string = function(buf, max) {
      var i, out, c, c_len;
      var len = max || buf.length;
      var utf16buf = new Array(len * 2);
      for (out = 0, i = 0; i < len; ) {
        c = buf[i++];
        if (c < 128) {
          utf16buf[out++] = c;
          continue;
        }
        c_len = _utf8len[c];
        if (c_len > 4) {
          utf16buf[out++] = 65533;
          i += c_len - 1;
          continue;
        }
        c &= c_len === 2 ? 31 : c_len === 3 ? 15 : 7;
        while (c_len > 1 && i < len) {
          c = c << 6 | buf[i++] & 63;
          c_len--;
        }
        if (c_len > 1) {
          utf16buf[out++] = 65533;
          continue;
        }
        if (c < 65536) {
          utf16buf[out++] = c;
        } else {
          c -= 65536;
          utf16buf[out++] = 55296 | c >> 10 & 1023;
          utf16buf[out++] = 56320 | c & 1023;
        }
      }
      return buf2binstring(utf16buf, out);
    };
    exports.utf8border = function(buf, max) {
      var pos;
      max = max || buf.length;
      if (max > buf.length) {
        max = buf.length;
      }
      pos = max - 1;
      while (pos >= 0 && (buf[pos] & 192) === 128) {
        pos--;
      }
      if (pos < 0) {
        return max;
      }
      if (pos === 0) {
        return max;
      }
      return pos + _utf8len[buf[pos]] > max ? pos : max;
    };
  }
});

// node_modules/pako/lib/zlib/zstream.js
var require_zstream = __commonJS({
  "node_modules/pako/lib/zlib/zstream.js"(exports, module) {
    "use strict";
    function ZStream() {
      this.input = null;
      this.next_in = 0;
      this.avail_in = 0;
      this.total_in = 0;
      this.output = null;
      this.next_out = 0;
      this.avail_out = 0;
      this.total_out = 0;
      this.msg = "";
      this.state = null;
      this.data_type = 2;
      this.adler = 0;
    }
    module.exports = ZStream;
  }
});

// node_modules/pako/lib/deflate.js
var require_deflate2 = __commonJS({
  "node_modules/pako/lib/deflate.js"(exports) {
    "use strict";
    var zlib_deflate = require_deflate();
    var utils = require_common();
    var strings = require_strings();
    var msg = require_messages();
    var ZStream = require_zstream();
    var toString = Object.prototype.toString;
    var Z_NO_FLUSH = 0;
    var Z_FINISH = 4;
    var Z_OK = 0;
    var Z_STREAM_END = 1;
    var Z_SYNC_FLUSH = 2;
    var Z_DEFAULT_COMPRESSION = -1;
    var Z_DEFAULT_STRATEGY = 0;
    var Z_DEFLATED = 8;
    function Deflate(options) {
      if (!(this instanceof Deflate)) return new Deflate(options);
      this.options = utils.assign({
        level: Z_DEFAULT_COMPRESSION,
        method: Z_DEFLATED,
        chunkSize: 16384,
        windowBits: 15,
        memLevel: 8,
        strategy: Z_DEFAULT_STRATEGY,
        to: ""
      }, options || {});
      var opt = this.options;
      if (opt.raw && opt.windowBits > 0) {
        opt.windowBits = -opt.windowBits;
      } else if (opt.gzip && opt.windowBits > 0 && opt.windowBits < 16) {
        opt.windowBits += 16;
      }
      this.err = 0;
      this.msg = "";
      this.ended = false;
      this.chunks = [];
      this.strm = new ZStream();
      this.strm.avail_out = 0;
      var status = zlib_deflate.deflateInit2(
        this.strm,
        opt.level,
        opt.method,
        opt.windowBits,
        opt.memLevel,
        opt.strategy
      );
      if (status !== Z_OK) {
        throw new Error(msg[status]);
      }
      if (opt.header) {
        zlib_deflate.deflateSetHeader(this.strm, opt.header);
      }
      if (opt.dictionary) {
        var dict;
        if (typeof opt.dictionary === "string") {
          dict = strings.string2buf(opt.dictionary);
        } else if (toString.call(opt.dictionary) === "[object ArrayBuffer]") {
          dict = new Uint8Array(opt.dictionary);
        } else {
          dict = opt.dictionary;
        }
        status = zlib_deflate.deflateSetDictionary(this.strm, dict);
        if (status !== Z_OK) {
          throw new Error(msg[status]);
        }
        this._dict_set = true;
      }
    }
    Deflate.prototype.push = function(data, mode) {
      var strm = this.strm;
      var chunkSize = this.options.chunkSize;
      var status, _mode;
      if (this.ended) {
        return false;
      }
      _mode = mode === ~~mode ? mode : mode === true ? Z_FINISH : Z_NO_FLUSH;
      if (typeof data === "string") {
        strm.input = strings.string2buf(data);
      } else if (toString.call(data) === "[object ArrayBuffer]") {
        strm.input = new Uint8Array(data);
      } else {
        strm.input = data;
      }
      strm.next_in = 0;
      strm.avail_in = strm.input.length;
      do {
        if (strm.avail_out === 0) {
          strm.output = new utils.Buf8(chunkSize);
          strm.next_out = 0;
          strm.avail_out = chunkSize;
        }
        status = zlib_deflate.deflate(strm, _mode);
        if (status !== Z_STREAM_END && status !== Z_OK) {
          this.onEnd(status);
          this.ended = true;
          return false;
        }
        if (strm.avail_out === 0 || strm.avail_in === 0 && (_mode === Z_FINISH || _mode === Z_SYNC_FLUSH)) {
          if (this.options.to === "string") {
            this.onData(strings.buf2binstring(utils.shrinkBuf(strm.output, strm.next_out)));
          } else {
            this.onData(utils.shrinkBuf(strm.output, strm.next_out));
          }
        }
      } while ((strm.avail_in > 0 || strm.avail_out === 0) && status !== Z_STREAM_END);
      if (_mode === Z_FINISH) {
        status = zlib_deflate.deflateEnd(this.strm);
        this.onEnd(status);
        this.ended = true;
        return status === Z_OK;
      }
      if (_mode === Z_SYNC_FLUSH) {
        this.onEnd(Z_OK);
        strm.avail_out = 0;
        return true;
      }
      return true;
    };
    Deflate.prototype.onData = function(chunk) {
      this.chunks.push(chunk);
    };
    Deflate.prototype.onEnd = function(status) {
      if (status === Z_OK) {
        if (this.options.to === "string") {
          this.result = this.chunks.join("");
        } else {
          this.result = utils.flattenChunks(this.chunks);
        }
      }
      this.chunks = [];
      this.err = status;
      this.msg = this.strm.msg;
    };
    function deflate(input, options) {
      var deflator = new Deflate(options);
      deflator.push(input, true);
      if (deflator.err) {
        throw deflator.msg || msg[deflator.err];
      }
      return deflator.result;
    }
    function deflateRaw(input, options) {
      options = options || {};
      options.raw = true;
      return deflate(input, options);
    }
    function gzip(input, options) {
      options = options || {};
      options.gzip = true;
      return deflate(input, options);
    }
    exports.Deflate = Deflate;
    exports.deflate = deflate;
    exports.deflateRaw = deflateRaw;
    exports.gzip = gzip;
  }
});

// node_modules/pako/lib/zlib/inffast.js
var require_inffast = __commonJS({
  "node_modules/pako/lib/zlib/inffast.js"(exports, module) {
    "use strict";
    var BAD = 30;
    var TYPE = 12;
    module.exports = function inflate_fast(strm, start) {
      var state;
      var _in;
      var last;
      var _out;
      var beg;
      var end;
      var dmax;
      var wsize;
      var whave;
      var wnext;
      var s_window;
      var hold;
      var bits;
      var lcode;
      var dcode;
      var lmask;
      var dmask;
      var here;
      var op;
      var len;
      var dist;
      var from;
      var from_source;
      var input, output;
      state = strm.state;
      _in = strm.next_in;
      input = strm.input;
      last = _in + (strm.avail_in - 5);
      _out = strm.next_out;
      output = strm.output;
      beg = _out - (start - strm.avail_out);
      end = _out + (strm.avail_out - 257);
      dmax = state.dmax;
      wsize = state.wsize;
      whave = state.whave;
      wnext = state.wnext;
      s_window = state.window;
      hold = state.hold;
      bits = state.bits;
      lcode = state.lencode;
      dcode = state.distcode;
      lmask = (1 << state.lenbits) - 1;
      dmask = (1 << state.distbits) - 1;
      top:
        do {
          if (bits < 15) {
            hold += input[_in++] << bits;
            bits += 8;
            hold += input[_in++] << bits;
            bits += 8;
          }
          here = lcode[hold & lmask];
          dolen:
            for (; ; ) {
              op = here >>> 24;
              hold >>>= op;
              bits -= op;
              op = here >>> 16 & 255;
              if (op === 0) {
                output[_out++] = here & 65535;
              } else if (op & 16) {
                len = here & 65535;
                op &= 15;
                if (op) {
                  if (bits < op) {
                    hold += input[_in++] << bits;
                    bits += 8;
                  }
                  len += hold & (1 << op) - 1;
                  hold >>>= op;
                  bits -= op;
                }
                if (bits < 15) {
                  hold += input[_in++] << bits;
                  bits += 8;
                  hold += input[_in++] << bits;
                  bits += 8;
                }
                here = dcode[hold & dmask];
                dodist:
                  for (; ; ) {
                    op = here >>> 24;
                    hold >>>= op;
                    bits -= op;
                    op = here >>> 16 & 255;
                    if (op & 16) {
                      dist = here & 65535;
                      op &= 15;
                      if (bits < op) {
                        hold += input[_in++] << bits;
                        bits += 8;
                        if (bits < op) {
                          hold += input[_in++] << bits;
                          bits += 8;
                        }
                      }
                      dist += hold & (1 << op) - 1;
                      if (dist > dmax) {
                        strm.msg = "invalid distance too far back";
                        state.mode = BAD;
                        break top;
                      }
                      hold >>>= op;
                      bits -= op;
                      op = _out - beg;
                      if (dist > op) {
                        op = dist - op;
                        if (op > whave) {
                          if (state.sane) {
                            strm.msg = "invalid distance too far back";
                            state.mode = BAD;
                            break top;
                          }
                        }
                        from = 0;
                        from_source = s_window;
                        if (wnext === 0) {
                          from += wsize - op;
                          if (op < len) {
                            len -= op;
                            do {
                              output[_out++] = s_window[from++];
                            } while (--op);
                            from = _out - dist;
                            from_source = output;
                          }
                        } else if (wnext < op) {
                          from += wsize + wnext - op;
                          op -= wnext;
                          if (op < len) {
                            len -= op;
                            do {
                              output[_out++] = s_window[from++];
                            } while (--op);
                            from = 0;
                            if (wnext < len) {
                              op = wnext;
                              len -= op;
                              do {
                                output[_out++] = s_window[from++];
                              } while (--op);
                              from = _out - dist;
                              from_source = output;
                            }
                          }
                        } else {
                          from += wnext - op;
                          if (op < len) {
                            len -= op;
                            do {
                              output[_out++] = s_window[from++];
                            } while (--op);
                            from = _out - dist;
                            from_source = output;
                          }
                        }
                        while (len > 2) {
                          output[_out++] = from_source[from++];
                          output[_out++] = from_source[from++];
                          output[_out++] = from_source[from++];
                          len -= 3;
                        }
                        if (len) {
                          output[_out++] = from_source[from++];
                          if (len > 1) {
                            output[_out++] = from_source[from++];
                          }
                        }
                      } else {
                        from = _out - dist;
                        do {
                          output[_out++] = output[from++];
                          output[_out++] = output[from++];
                          output[_out++] = output[from++];
                          len -= 3;
                        } while (len > 2);
                        if (len) {
                          output[_out++] = output[from++];
                          if (len > 1) {
                            output[_out++] = output[from++];
                          }
                        }
                      }
                    } else if ((op & 64) === 0) {
                      here = dcode[(here & 65535) + (hold & (1 << op) - 1)];
                      continue dodist;
                    } else {
                      strm.msg = "invalid distance code";
                      state.mode = BAD;
                      break top;
                    }
                    break;
                  }
              } else if ((op & 64) === 0) {
                here = lcode[(here & 65535) + (hold & (1 << op) - 1)];
                continue dolen;
              } else if (op & 32) {
                state.mode = TYPE;
                break top;
              } else {
                strm.msg = "invalid literal/length code";
                state.mode = BAD;
                break top;
              }
              break;
            }
        } while (_in < last && _out < end);
      len = bits >> 3;
      _in -= len;
      bits -= len << 3;
      hold &= (1 << bits) - 1;
      strm.next_in = _in;
      strm.next_out = _out;
      strm.avail_in = _in < last ? 5 + (last - _in) : 5 - (_in - last);
      strm.avail_out = _out < end ? 257 + (end - _out) : 257 - (_out - end);
      state.hold = hold;
      state.bits = bits;
      return;
    };
  }
});

// node_modules/pako/lib/zlib/inftrees.js
var require_inftrees = __commonJS({
  "node_modules/pako/lib/zlib/inftrees.js"(exports, module) {
    "use strict";
    var utils = require_common();
    var MAXBITS = 15;
    var ENOUGH_LENS = 852;
    var ENOUGH_DISTS = 592;
    var CODES = 0;
    var LENS = 1;
    var DISTS = 2;
    var lbase = [
      /* Length codes 257..285 base */
      3,
      4,
      5,
      6,
      7,
      8,
      9,
      10,
      11,
      13,
      15,
      17,
      19,
      23,
      27,
      31,
      35,
      43,
      51,
      59,
      67,
      83,
      99,
      115,
      131,
      163,
      195,
      227,
      258,
      0,
      0
    ];
    var lext = [
      /* Length codes 257..285 extra */
      16,
      16,
      16,
      16,
      16,
      16,
      16,
      16,
      17,
      17,
      17,
      17,
      18,
      18,
      18,
      18,
      19,
      19,
      19,
      19,
      20,
      20,
      20,
      20,
      21,
      21,
      21,
      21,
      16,
      72,
      78
    ];
    var dbase = [
      /* Distance codes 0..29 base */
      1,
      2,
      3,
      4,
      5,
      7,
      9,
      13,
      17,
      25,
      33,
      49,
      65,
      97,
      129,
      193,
      257,
      385,
      513,
      769,
      1025,
      1537,
      2049,
      3073,
      4097,
      6145,
      8193,
      12289,
      16385,
      24577,
      0,
      0
    ];
    var dext = [
      /* Distance codes 0..29 extra */
      16,
      16,
      16,
      16,
      17,
      17,
      18,
      18,
      19,
      19,
      20,
      20,
      21,
      21,
      22,
      22,
      23,
      23,
      24,
      24,
      25,
      25,
      26,
      26,
      27,
      27,
      28,
      28,
      29,
      29,
      64,
      64
    ];
    module.exports = function inflate_table(type, lens, lens_index, codes, table, table_index, work, opts) {
      var bits = opts.bits;
      var len = 0;
      var sym = 0;
      var min = 0, max = 0;
      var root = 0;
      var curr = 0;
      var drop = 0;
      var left = 0;
      var used = 0;
      var huff = 0;
      var incr;
      var fill;
      var low;
      var mask;
      var next;
      var base = null;
      var base_index = 0;
      var end;
      var count = new utils.Buf16(MAXBITS + 1);
      var offs = new utils.Buf16(MAXBITS + 1);
      var extra = null;
      var extra_index = 0;
      var here_bits, here_op, here_val;
      for (len = 0; len <= MAXBITS; len++) {
        count[len] = 0;
      }
      for (sym = 0; sym < codes; sym++) {
        count[lens[lens_index + sym]]++;
      }
      root = bits;
      for (max = MAXBITS; max >= 1; max--) {
        if (count[max] !== 0) {
          break;
        }
      }
      if (root > max) {
        root = max;
      }
      if (max === 0) {
        table[table_index++] = 1 << 24 | 64 << 16 | 0;
        table[table_index++] = 1 << 24 | 64 << 16 | 0;
        opts.bits = 1;
        return 0;
      }
      for (min = 1; min < max; min++) {
        if (count[min] !== 0) {
          break;
        }
      }
      if (root < min) {
        root = min;
      }
      left = 1;
      for (len = 1; len <= MAXBITS; len++) {
        left <<= 1;
        left -= count[len];
        if (left < 0) {
          return -1;
        }
      }
      if (left > 0 && (type === CODES || max !== 1)) {
        return -1;
      }
      offs[1] = 0;
      for (len = 1; len < MAXBITS; len++) {
        offs[len + 1] = offs[len] + count[len];
      }
      for (sym = 0; sym < codes; sym++) {
        if (lens[lens_index + sym] !== 0) {
          work[offs[lens[lens_index + sym]]++] = sym;
        }
      }
      if (type === CODES) {
        base = extra = work;
        end = 19;
      } else if (type === LENS) {
        base = lbase;
        base_index -= 257;
        extra = lext;
        extra_index -= 257;
        end = 256;
      } else {
        base = dbase;
        extra = dext;
        end = -1;
      }
      huff = 0;
      sym = 0;
      len = min;
      next = table_index;
      curr = root;
      drop = 0;
      low = -1;
      used = 1 << root;
      mask = used - 1;
      if (type === LENS && used > ENOUGH_LENS || type === DISTS && used > ENOUGH_DISTS) {
        return 1;
      }
      for (; ; ) {
        here_bits = len - drop;
        if (work[sym] < end) {
          here_op = 0;
          here_val = work[sym];
        } else if (work[sym] > end) {
          here_op = extra[extra_index + work[sym]];
          here_val = base[base_index + work[sym]];
        } else {
          here_op = 32 + 64;
          here_val = 0;
        }
        incr = 1 << len - drop;
        fill = 1 << curr;
        min = fill;
        do {
          fill -= incr;
          table[next + (huff >> drop) + fill] = here_bits << 24 | here_op << 16 | here_val | 0;
        } while (fill !== 0);
        incr = 1 << len - 1;
        while (huff & incr) {
          incr >>= 1;
        }
        if (incr !== 0) {
          huff &= incr - 1;
          huff += incr;
        } else {
          huff = 0;
        }
        sym++;
        if (--count[len] === 0) {
          if (len === max) {
            break;
          }
          len = lens[lens_index + work[sym]];
        }
        if (len > root && (huff & mask) !== low) {
          if (drop === 0) {
            drop = root;
          }
          next += min;
          curr = len - drop;
          left = 1 << curr;
          while (curr + drop < max) {
            left -= count[curr + drop];
            if (left <= 0) {
              break;
            }
            curr++;
            left <<= 1;
          }
          used += 1 << curr;
          if (type === LENS && used > ENOUGH_LENS || type === DISTS && used > ENOUGH_DISTS) {
            return 1;
          }
          low = huff & mask;
          table[low] = root << 24 | curr << 16 | next - table_index | 0;
        }
      }
      if (huff !== 0) {
        table[next + huff] = len - drop << 24 | 64 << 16 | 0;
      }
      opts.bits = root;
      return 0;
    };
  }
});

// node_modules/pako/lib/zlib/inflate.js
var require_inflate = __commonJS({
  "node_modules/pako/lib/zlib/inflate.js"(exports) {
    "use strict";
    var utils = require_common();
    var adler32 = require_adler32();
    var crc32 = require_crc32();
    var inflate_fast = require_inffast();
    var inflate_table = require_inftrees();
    var CODES = 0;
    var LENS = 1;
    var DISTS = 2;
    var Z_FINISH = 4;
    var Z_BLOCK = 5;
    var Z_TREES = 6;
    var Z_OK = 0;
    var Z_STREAM_END = 1;
    var Z_NEED_DICT = 2;
    var Z_STREAM_ERROR = -2;
    var Z_DATA_ERROR = -3;
    var Z_MEM_ERROR = -4;
    var Z_BUF_ERROR = -5;
    var Z_DEFLATED = 8;
    var HEAD = 1;
    var FLAGS = 2;
    var TIME = 3;
    var OS = 4;
    var EXLEN = 5;
    var EXTRA = 6;
    var NAME = 7;
    var COMMENT = 8;
    var HCRC = 9;
    var DICTID = 10;
    var DICT = 11;
    var TYPE = 12;
    var TYPEDO = 13;
    var STORED = 14;
    var COPY_ = 15;
    var COPY = 16;
    var TABLE = 17;
    var LENLENS = 18;
    var CODELENS = 19;
    var LEN_ = 20;
    var LEN = 21;
    var LENEXT = 22;
    var DIST = 23;
    var DISTEXT = 24;
    var MATCH = 25;
    var LIT = 26;
    var CHECK = 27;
    var LENGTH = 28;
    var DONE = 29;
    var BAD = 30;
    var MEM = 31;
    var SYNC = 32;
    var ENOUGH_LENS = 852;
    var ENOUGH_DISTS = 592;
    var MAX_WBITS = 15;
    var DEF_WBITS = MAX_WBITS;
    function zswap32(q) {
      return (q >>> 24 & 255) + (q >>> 8 & 65280) + ((q & 65280) << 8) + ((q & 255) << 24);
    }
    function InflateState() {
      this.mode = 0;
      this.last = false;
      this.wrap = 0;
      this.havedict = false;
      this.flags = 0;
      this.dmax = 0;
      this.check = 0;
      this.total = 0;
      this.head = null;
      this.wbits = 0;
      this.wsize = 0;
      this.whave = 0;
      this.wnext = 0;
      this.window = null;
      this.hold = 0;
      this.bits = 0;
      this.length = 0;
      this.offset = 0;
      this.extra = 0;
      this.lencode = null;
      this.distcode = null;
      this.lenbits = 0;
      this.distbits = 0;
      this.ncode = 0;
      this.nlen = 0;
      this.ndist = 0;
      this.have = 0;
      this.next = null;
      this.lens = new utils.Buf16(320);
      this.work = new utils.Buf16(288);
      this.lendyn = null;
      this.distdyn = null;
      this.sane = 0;
      this.back = 0;
      this.was = 0;
    }
    function inflateResetKeep(strm) {
      var state;
      if (!strm || !strm.state) {
        return Z_STREAM_ERROR;
      }
      state = strm.state;
      strm.total_in = strm.total_out = state.total = 0;
      strm.msg = "";
      if (state.wrap) {
        strm.adler = state.wrap & 1;
      }
      state.mode = HEAD;
      state.last = 0;
      state.havedict = 0;
      state.dmax = 32768;
      state.head = null;
      state.hold = 0;
      state.bits = 0;
      state.lencode = state.lendyn = new utils.Buf32(ENOUGH_LENS);
      state.distcode = state.distdyn = new utils.Buf32(ENOUGH_DISTS);
      state.sane = 1;
      state.back = -1;
      return Z_OK;
    }
    function inflateReset(strm) {
      var state;
      if (!strm || !strm.state) {
        return Z_STREAM_ERROR;
      }
      state = strm.state;
      state.wsize = 0;
      state.whave = 0;
      state.wnext = 0;
      return inflateResetKeep(strm);
    }
    function inflateReset2(strm, windowBits) {
      var wrap;
      var state;
      if (!strm || !strm.state) {
        return Z_STREAM_ERROR;
      }
      state = strm.state;
      if (windowBits < 0) {
        wrap = 0;
        windowBits = -windowBits;
      } else {
        wrap = (windowBits >> 4) + 1;
        if (windowBits < 48) {
          windowBits &= 15;
        }
      }
      if (windowBits && (windowBits < 8 || windowBits > 15)) {
        return Z_STREAM_ERROR;
      }
      if (state.window !== null && state.wbits !== windowBits) {
        state.window = null;
      }
      state.wrap = wrap;
      state.wbits = windowBits;
      return inflateReset(strm);
    }
    function inflateInit2(strm, windowBits) {
      var ret;
      var state;
      if (!strm) {
        return Z_STREAM_ERROR;
      }
      state = new InflateState();
      strm.state = state;
      state.window = null;
      ret = inflateReset2(strm, windowBits);
      if (ret !== Z_OK) {
        strm.state = null;
      }
      return ret;
    }
    function inflateInit(strm) {
      return inflateInit2(strm, DEF_WBITS);
    }
    var virgin = true;
    var lenfix;
    var distfix;
    function fixedtables(state) {
      if (virgin) {
        var sym;
        lenfix = new utils.Buf32(512);
        distfix = new utils.Buf32(32);
        sym = 0;
        while (sym < 144) {
          state.lens[sym++] = 8;
        }
        while (sym < 256) {
          state.lens[sym++] = 9;
        }
        while (sym < 280) {
          state.lens[sym++] = 7;
        }
        while (sym < 288) {
          state.lens[sym++] = 8;
        }
        inflate_table(LENS, state.lens, 0, 288, lenfix, 0, state.work, { bits: 9 });
        sym = 0;
        while (sym < 32) {
          state.lens[sym++] = 5;
        }
        inflate_table(DISTS, state.lens, 0, 32, distfix, 0, state.work, { bits: 5 });
        virgin = false;
      }
      state.lencode = lenfix;
      state.lenbits = 9;
      state.distcode = distfix;
      state.distbits = 5;
    }
    function updatewindow(strm, src, end, copy) {
      var dist;
      var state = strm.state;
      if (state.window === null) {
        state.wsize = 1 << state.wbits;
        state.wnext = 0;
        state.whave = 0;
        state.window = new utils.Buf8(state.wsize);
      }
      if (copy >= state.wsize) {
        utils.arraySet(state.window, src, end - state.wsize, state.wsize, 0);
        state.wnext = 0;
        state.whave = state.wsize;
      } else {
        dist = state.wsize - state.wnext;
        if (dist > copy) {
          dist = copy;
        }
        utils.arraySet(state.window, src, end - copy, dist, state.wnext);
        copy -= dist;
        if (copy) {
          utils.arraySet(state.window, src, end - copy, copy, 0);
          state.wnext = copy;
          state.whave = state.wsize;
        } else {
          state.wnext += dist;
          if (state.wnext === state.wsize) {
            state.wnext = 0;
          }
          if (state.whave < state.wsize) {
            state.whave += dist;
          }
        }
      }
      return 0;
    }
    function inflate(strm, flush) {
      var state;
      var input, output;
      var next;
      var put;
      var have, left;
      var hold;
      var bits;
      var _in, _out;
      var copy;
      var from;
      var from_source;
      var here = 0;
      var here_bits, here_op, here_val;
      var last_bits, last_op, last_val;
      var len;
      var ret;
      var hbuf = new utils.Buf8(4);
      var opts;
      var n;
      var order = (
        /* permutation of code lengths */
        [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15]
      );
      if (!strm || !strm.state || !strm.output || !strm.input && strm.avail_in !== 0) {
        return Z_STREAM_ERROR;
      }
      state = strm.state;
      if (state.mode === TYPE) {
        state.mode = TYPEDO;
      }
      put = strm.next_out;
      output = strm.output;
      left = strm.avail_out;
      next = strm.next_in;
      input = strm.input;
      have = strm.avail_in;
      hold = state.hold;
      bits = state.bits;
      _in = have;
      _out = left;
      ret = Z_OK;
      inf_leave:
        for (; ; ) {
          switch (state.mode) {
            case HEAD:
              if (state.wrap === 0) {
                state.mode = TYPEDO;
                break;
              }
              while (bits < 16) {
                if (have === 0) {
                  break inf_leave;
                }
                have--;
                hold += input[next++] << bits;
                bits += 8;
              }
              if (state.wrap & 2 && hold === 35615) {
                state.check = 0;
                hbuf[0] = hold & 255;
                hbuf[1] = hold >>> 8 & 255;
                state.check = crc32(state.check, hbuf, 2, 0);
                hold = 0;
                bits = 0;
                state.mode = FLAGS;
                break;
              }
              state.flags = 0;
              if (state.head) {
                state.head.done = false;
              }
              if (!(state.wrap & 1) || /* check if zlib header allowed */
              (((hold & 255) << 8) + (hold >> 8)) % 31) {
                strm.msg = "incorrect header check";
                state.mode = BAD;
                break;
              }
              if ((hold & 15) !== Z_DEFLATED) {
                strm.msg = "unknown compression method";
                state.mode = BAD;
                break;
              }
              hold >>>= 4;
              bits -= 4;
              len = (hold & 15) + 8;
              if (state.wbits === 0) {
                state.wbits = len;
              } else if (len > state.wbits) {
                strm.msg = "invalid window size";
                state.mode = BAD;
                break;
              }
              state.dmax = 1 << len;
              strm.adler = state.check = 1;
              state.mode = hold & 512 ? DICTID : TYPE;
              hold = 0;
              bits = 0;
              break;
            case FLAGS:
              while (bits < 16) {
                if (have === 0) {
                  break inf_leave;
                }
                have--;
                hold += input[next++] << bits;
                bits += 8;
              }
              state.flags = hold;
              if ((state.flags & 255) !== Z_DEFLATED) {
                strm.msg = "unknown compression method";
                state.mode = BAD;
                break;
              }
              if (state.flags & 57344) {
                strm.msg = "unknown header flags set";
                state.mode = BAD;
                break;
              }
              if (state.head) {
                state.head.text = hold >> 8 & 1;
              }
              if (state.flags & 512) {
                hbuf[0] = hold & 255;
                hbuf[1] = hold >>> 8 & 255;
                state.check = crc32(state.check, hbuf, 2, 0);
              }
              hold = 0;
              bits = 0;
              state.mode = TIME;
            /* falls through */
            case TIME:
              while (bits < 32) {
                if (have === 0) {
                  break inf_leave;
                }
                have--;
                hold += input[next++] << bits;
                bits += 8;
              }
              if (state.head) {
                state.head.time = hold;
              }
              if (state.flags & 512) {
                hbuf[0] = hold & 255;
                hbuf[1] = hold >>> 8 & 255;
                hbuf[2] = hold >>> 16 & 255;
                hbuf[3] = hold >>> 24 & 255;
                state.check = crc32(state.check, hbuf, 4, 0);
              }
              hold = 0;
              bits = 0;
              state.mode = OS;
            /* falls through */
            case OS:
              while (bits < 16) {
                if (have === 0) {
                  break inf_leave;
                }
                have--;
                hold += input[next++] << bits;
                bits += 8;
              }
              if (state.head) {
                state.head.xflags = hold & 255;
                state.head.os = hold >> 8;
              }
              if (state.flags & 512) {
                hbuf[0] = hold & 255;
                hbuf[1] = hold >>> 8 & 255;
                state.check = crc32(state.check, hbuf, 2, 0);
              }
              hold = 0;
              bits = 0;
              state.mode = EXLEN;
            /* falls through */
            case EXLEN:
              if (state.flags & 1024) {
                while (bits < 16) {
                  if (have === 0) {
                    break inf_leave;
                  }
                  have--;
                  hold += input[next++] << bits;
                  bits += 8;
                }
                state.length = hold;
                if (state.head) {
                  state.head.extra_len = hold;
                }
                if (state.flags & 512) {
                  hbuf[0] = hold & 255;
                  hbuf[1] = hold >>> 8 & 255;
                  state.check = crc32(state.check, hbuf, 2, 0);
                }
                hold = 0;
                bits = 0;
              } else if (state.head) {
                state.head.extra = null;
              }
              state.mode = EXTRA;
            /* falls through */
            case EXTRA:
              if (state.flags & 1024) {
                copy = state.length;
                if (copy > have) {
                  copy = have;
                }
                if (copy) {
                  if (state.head) {
                    len = state.head.extra_len - state.length;
                    if (!state.head.extra) {
                      state.head.extra = new Array(state.head.extra_len);
                    }
                    utils.arraySet(
                      state.head.extra,
                      input,
                      next,
                      // extra field is limited to 65536 bytes
                      // - no need for additional size check
                      copy,
                      /*len + copy > state.head.extra_max - len ? state.head.extra_max : copy,*/
                      len
                    );
                  }
                  if (state.flags & 512) {
                    state.check = crc32(state.check, input, copy, next);
                  }
                  have -= copy;
                  next += copy;
                  state.length -= copy;
                }
                if (state.length) {
                  break inf_leave;
                }
              }
              state.length = 0;
              state.mode = NAME;
            /* falls through */
            case NAME:
              if (state.flags & 2048) {
                if (have === 0) {
                  break inf_leave;
                }
                copy = 0;
                do {
                  len = input[next + copy++];
                  if (state.head && len && state.length < 65536) {
                    state.head.name += String.fromCharCode(len);
                  }
                } while (len && copy < have);
                if (state.flags & 512) {
                  state.check = crc32(state.check, input, copy, next);
                }
                have -= copy;
                next += copy;
                if (len) {
                  break inf_leave;
                }
              } else if (state.head) {
                state.head.name = null;
              }
              state.length = 0;
              state.mode = COMMENT;
            /* falls through */
            case COMMENT:
              if (state.flags & 4096) {
                if (have === 0) {
                  break inf_leave;
                }
                copy = 0;
                do {
                  len = input[next + copy++];
                  if (state.head && len && state.length < 65536) {
                    state.head.comment += String.fromCharCode(len);
                  }
                } while (len && copy < have);
                if (state.flags & 512) {
                  state.check = crc32(state.check, input, copy, next);
                }
                have -= copy;
                next += copy;
                if (len) {
                  break inf_leave;
                }
              } else if (state.head) {
                state.head.comment = null;
              }
              state.mode = HCRC;
            /* falls through */
            case HCRC:
              if (state.flags & 512) {
                while (bits < 16) {
                  if (have === 0) {
                    break inf_leave;
                  }
                  have--;
                  hold += input[next++] << bits;
                  bits += 8;
                }
                if (hold !== (state.check & 65535)) {
                  strm.msg = "header crc mismatch";
                  state.mode = BAD;
                  break;
                }
                hold = 0;
                bits = 0;
              }
              if (state.head) {
                state.head.hcrc = state.flags >> 9 & 1;
                state.head.done = true;
              }
              strm.adler = state.check = 0;
              state.mode = TYPE;
              break;
            case DICTID:
              while (bits < 32) {
                if (have === 0) {
                  break inf_leave;
                }
                have--;
                hold += input[next++] << bits;
                bits += 8;
              }
              strm.adler = state.check = zswap32(hold);
              hold = 0;
              bits = 0;
              state.mode = DICT;
            /* falls through */
            case DICT:
              if (state.havedict === 0) {
                strm.next_out = put;
                strm.avail_out = left;
                strm.next_in = next;
                strm.avail_in = have;
                state.hold = hold;
                state.bits = bits;
                return Z_NEED_DICT;
              }
              strm.adler = state.check = 1;
              state.mode = TYPE;
            /* falls through */
            case TYPE:
              if (flush === Z_BLOCK || flush === Z_TREES) {
                break inf_leave;
              }
            /* falls through */
            case TYPEDO:
              if (state.last) {
                hold >>>= bits & 7;
                bits -= bits & 7;
                state.mode = CHECK;
                break;
              }
              while (bits < 3) {
                if (have === 0) {
                  break inf_leave;
                }
                have--;
                hold += input[next++] << bits;
                bits += 8;
              }
              state.last = hold & 1;
              hold >>>= 1;
              bits -= 1;
              switch (hold & 3) {
                case 0:
                  state.mode = STORED;
                  break;
                case 1:
                  fixedtables(state);
                  state.mode = LEN_;
                  if (flush === Z_TREES) {
                    hold >>>= 2;
                    bits -= 2;
                    break inf_leave;
                  }
                  break;
                case 2:
                  state.mode = TABLE;
                  break;
                case 3:
                  strm.msg = "invalid block type";
                  state.mode = BAD;
              }
              hold >>>= 2;
              bits -= 2;
              break;
            case STORED:
              hold >>>= bits & 7;
              bits -= bits & 7;
              while (bits < 32) {
                if (have === 0) {
                  break inf_leave;
                }
                have--;
                hold += input[next++] << bits;
                bits += 8;
              }
              if ((hold & 65535) !== (hold >>> 16 ^ 65535)) {
                strm.msg = "invalid stored block lengths";
                state.mode = BAD;
                break;
              }
              state.length = hold & 65535;
              hold = 0;
              bits = 0;
              state.mode = COPY_;
              if (flush === Z_TREES) {
                break inf_leave;
              }
            /* falls through */
            case COPY_:
              state.mode = COPY;
            /* falls through */
            case COPY:
              copy = state.length;
              if (copy) {
                if (copy > have) {
                  copy = have;
                }
                if (copy > left) {
                  copy = left;
                }
                if (copy === 0) {
                  break inf_leave;
                }
                utils.arraySet(output, input, next, copy, put);
                have -= copy;
                next += copy;
                left -= copy;
                put += copy;
                state.length -= copy;
                break;
              }
              state.mode = TYPE;
              break;
            case TABLE:
              while (bits < 14) {
                if (have === 0) {
                  break inf_leave;
                }
                have--;
                hold += input[next++] << bits;
                bits += 8;
              }
              state.nlen = (hold & 31) + 257;
              hold >>>= 5;
              bits -= 5;
              state.ndist = (hold & 31) + 1;
              hold >>>= 5;
              bits -= 5;
              state.ncode = (hold & 15) + 4;
              hold >>>= 4;
              bits -= 4;
              if (state.nlen > 286 || state.ndist > 30) {
                strm.msg = "too many length or distance symbols";
                state.mode = BAD;
                break;
              }
              state.have = 0;
              state.mode = LENLENS;
            /* falls through */
            case LENLENS:
              while (state.have < state.ncode) {
                while (bits < 3) {
                  if (have === 0) {
                    break inf_leave;
                  }
                  have--;
                  hold += input[next++] << bits;
                  bits += 8;
                }
                state.lens[order[state.have++]] = hold & 7;
                hold >>>= 3;
                bits -= 3;
              }
              while (state.have < 19) {
                state.lens[order[state.have++]] = 0;
              }
              state.lencode = state.lendyn;
              state.lenbits = 7;
              opts = { bits: state.lenbits };
              ret = inflate_table(CODES, state.lens, 0, 19, state.lencode, 0, state.work, opts);
              state.lenbits = opts.bits;
              if (ret) {
                strm.msg = "invalid code lengths set";
                state.mode = BAD;
                break;
              }
              state.have = 0;
              state.mode = CODELENS;
            /* falls through */
            case CODELENS:
              while (state.have < state.nlen + state.ndist) {
                for (; ; ) {
                  here = state.lencode[hold & (1 << state.lenbits) - 1];
                  here_bits = here >>> 24;
                  here_op = here >>> 16 & 255;
                  here_val = here & 65535;
                  if (here_bits <= bits) {
                    break;
                  }
                  if (have === 0) {
                    break inf_leave;
                  }
                  have--;
                  hold += input[next++] << bits;
                  bits += 8;
                }
                if (here_val < 16) {
                  hold >>>= here_bits;
                  bits -= here_bits;
                  state.lens[state.have++] = here_val;
                } else {
                  if (here_val === 16) {
                    n = here_bits + 2;
                    while (bits < n) {
                      if (have === 0) {
                        break inf_leave;
                      }
                      have--;
                      hold += input[next++] << bits;
                      bits += 8;
                    }
                    hold >>>= here_bits;
                    bits -= here_bits;
                    if (state.have === 0) {
                      strm.msg = "invalid bit length repeat";
                      state.mode = BAD;
                      break;
                    }
                    len = state.lens[state.have - 1];
                    copy = 3 + (hold & 3);
                    hold >>>= 2;
                    bits -= 2;
                  } else if (here_val === 17) {
                    n = here_bits + 3;
                    while (bits < n) {
                      if (have === 0) {
                        break inf_leave;
                      }
                      have--;
                      hold += input[next++] << bits;
                      bits += 8;
                    }
                    hold >>>= here_bits;
                    bits -= here_bits;
                    len = 0;
                    copy = 3 + (hold & 7);
                    hold >>>= 3;
                    bits -= 3;
                  } else {
                    n = here_bits + 7;
                    while (bits < n) {
                      if (have === 0) {
                        break inf_leave;
                      }
                      have--;
                      hold += input[next++] << bits;
                      bits += 8;
                    }
                    hold >>>= here_bits;
                    bits -= here_bits;
                    len = 0;
                    copy = 11 + (hold & 127);
                    hold >>>= 7;
                    bits -= 7;
                  }
                  if (state.have + copy > state.nlen + state.ndist) {
                    strm.msg = "invalid bit length repeat";
                    state.mode = BAD;
                    break;
                  }
                  while (copy--) {
                    state.lens[state.have++] = len;
                  }
                }
              }
              if (state.mode === BAD) {
                break;
              }
              if (state.lens[256] === 0) {
                strm.msg = "invalid code -- missing end-of-block";
                state.mode = BAD;
                break;
              }
              state.lenbits = 9;
              opts = { bits: state.lenbits };
              ret = inflate_table(LENS, state.lens, 0, state.nlen, state.lencode, 0, state.work, opts);
              state.lenbits = opts.bits;
              if (ret) {
                strm.msg = "invalid literal/lengths set";
                state.mode = BAD;
                break;
              }
              state.distbits = 6;
              state.distcode = state.distdyn;
              opts = { bits: state.distbits };
              ret = inflate_table(DISTS, state.lens, state.nlen, state.ndist, state.distcode, 0, state.work, opts);
              state.distbits = opts.bits;
              if (ret) {
                strm.msg = "invalid distances set";
                state.mode = BAD;
                break;
              }
              state.mode = LEN_;
              if (flush === Z_TREES) {
                break inf_leave;
              }
            /* falls through */
            case LEN_:
              state.mode = LEN;
            /* falls through */
            case LEN:
              if (have >= 6 && left >= 258) {
                strm.next_out = put;
                strm.avail_out = left;
                strm.next_in = next;
                strm.avail_in = have;
                state.hold = hold;
                state.bits = bits;
                inflate_fast(strm, _out);
                put = strm.next_out;
                output = strm.output;
                left = strm.avail_out;
                next = strm.next_in;
                input = strm.input;
                have = strm.avail_in;
                hold = state.hold;
                bits = state.bits;
                if (state.mode === TYPE) {
                  state.back = -1;
                }
                break;
              }
              state.back = 0;
              for (; ; ) {
                here = state.lencode[hold & (1 << state.lenbits) - 1];
                here_bits = here >>> 24;
                here_op = here >>> 16 & 255;
                here_val = here & 65535;
                if (here_bits <= bits) {
                  break;
                }
                if (have === 0) {
                  break inf_leave;
                }
                have--;
                hold += input[next++] << bits;
                bits += 8;
              }
              if (here_op && (here_op & 240) === 0) {
                last_bits = here_bits;
                last_op = here_op;
                last_val = here_val;
                for (; ; ) {
                  here = state.lencode[last_val + ((hold & (1 << last_bits + last_op) - 1) >> last_bits)];
                  here_bits = here >>> 24;
                  here_op = here >>> 16 & 255;
                  here_val = here & 65535;
                  if (last_bits + here_bits <= bits) {
                    break;
                  }
                  if (have === 0) {
                    break inf_leave;
                  }
                  have--;
                  hold += input[next++] << bits;
                  bits += 8;
                }
                hold >>>= last_bits;
                bits -= last_bits;
                state.back += last_bits;
              }
              hold >>>= here_bits;
              bits -= here_bits;
              state.back += here_bits;
              state.length = here_val;
              if (here_op === 0) {
                state.mode = LIT;
                break;
              }
              if (here_op & 32) {
                state.back = -1;
                state.mode = TYPE;
                break;
              }
              if (here_op & 64) {
                strm.msg = "invalid literal/length code";
                state.mode = BAD;
                break;
              }
              state.extra = here_op & 15;
              state.mode = LENEXT;
            /* falls through */
            case LENEXT:
              if (state.extra) {
                n = state.extra;
                while (bits < n) {
                  if (have === 0) {
                    break inf_leave;
                  }
                  have--;
                  hold += input[next++] << bits;
                  bits += 8;
                }
                state.length += hold & (1 << state.extra) - 1;
                hold >>>= state.extra;
                bits -= state.extra;
                state.back += state.extra;
              }
              state.was = state.length;
              state.mode = DIST;
            /* falls through */
            case DIST:
              for (; ; ) {
                here = state.distcode[hold & (1 << state.distbits) - 1];
                here_bits = here >>> 24;
                here_op = here >>> 16 & 255;
                here_val = here & 65535;
                if (here_bits <= bits) {
                  break;
                }
                if (have === 0) {
                  break inf_leave;
                }
                have--;
                hold += input[next++] << bits;
                bits += 8;
              }
              if ((here_op & 240) === 0) {
                last_bits = here_bits;
                last_op = here_op;
                last_val = here_val;
                for (; ; ) {
                  here = state.distcode[last_val + ((hold & (1 << last_bits + last_op) - 1) >> last_bits)];
                  here_bits = here >>> 24;
                  here_op = here >>> 16 & 255;
                  here_val = here & 65535;
                  if (last_bits + here_bits <= bits) {
                    break;
                  }
                  if (have === 0) {
                    break inf_leave;
                  }
                  have--;
                  hold += input[next++] << bits;
                  bits += 8;
                }
                hold >>>= last_bits;
                bits -= last_bits;
                state.back += last_bits;
              }
              hold >>>= here_bits;
              bits -= here_bits;
              state.back += here_bits;
              if (here_op & 64) {
                strm.msg = "invalid distance code";
                state.mode = BAD;
                break;
              }
              state.offset = here_val;
              state.extra = here_op & 15;
              state.mode = DISTEXT;
            /* falls through */
            case DISTEXT:
              if (state.extra) {
                n = state.extra;
                while (bits < n) {
                  if (have === 0) {
                    break inf_leave;
                  }
                  have--;
                  hold += input[next++] << bits;
                  bits += 8;
                }
                state.offset += hold & (1 << state.extra) - 1;
                hold >>>= state.extra;
                bits -= state.extra;
                state.back += state.extra;
              }
              if (state.offset > state.dmax) {
                strm.msg = "invalid distance too far back";
                state.mode = BAD;
                break;
              }
              state.mode = MATCH;
            /* falls through */
            case MATCH:
              if (left === 0) {
                break inf_leave;
              }
              copy = _out - left;
              if (state.offset > copy) {
                copy = state.offset - copy;
                if (copy > state.whave) {
                  if (state.sane) {
                    strm.msg = "invalid distance too far back";
                    state.mode = BAD;
                    break;
                  }
                }
                if (copy > state.wnext) {
                  copy -= state.wnext;
                  from = state.wsize - copy;
                } else {
                  from = state.wnext - copy;
                }
                if (copy > state.length) {
                  copy = state.length;
                }
                from_source = state.window;
              } else {
                from_source = output;
                from = put - state.offset;
                copy = state.length;
              }
              if (copy > left) {
                copy = left;
              }
              left -= copy;
              state.length -= copy;
              do {
                output[put++] = from_source[from++];
              } while (--copy);
              if (state.length === 0) {
                state.mode = LEN;
              }
              break;
            case LIT:
              if (left === 0) {
                break inf_leave;
              }
              output[put++] = state.length;
              left--;
              state.mode = LEN;
              break;
            case CHECK:
              if (state.wrap) {
                while (bits < 32) {
                  if (have === 0) {
                    break inf_leave;
                  }
                  have--;
                  hold |= input[next++] << bits;
                  bits += 8;
                }
                _out -= left;
                strm.total_out += _out;
                state.total += _out;
                if (_out) {
                  strm.adler = state.check = /*UPDATE(state.check, put - _out, _out);*/
                  state.flags ? crc32(state.check, output, _out, put - _out) : adler32(state.check, output, _out, put - _out);
                }
                _out = left;
                if ((state.flags ? hold : zswap32(hold)) !== state.check) {
                  strm.msg = "incorrect data check";
                  state.mode = BAD;
                  break;
                }
                hold = 0;
                bits = 0;
              }
              state.mode = LENGTH;
            /* falls through */
            case LENGTH:
              if (state.wrap && state.flags) {
                while (bits < 32) {
                  if (have === 0) {
                    break inf_leave;
                  }
                  have--;
                  hold += input[next++] << bits;
                  bits += 8;
                }
                if (hold !== (state.total & 4294967295)) {
                  strm.msg = "incorrect length check";
                  state.mode = BAD;
                  break;
                }
                hold = 0;
                bits = 0;
              }
              state.mode = DONE;
            /* falls through */
            case DONE:
              ret = Z_STREAM_END;
              break inf_leave;
            case BAD:
              ret = Z_DATA_ERROR;
              break inf_leave;
            case MEM:
              return Z_MEM_ERROR;
            case SYNC:
            /* falls through */
            default:
              return Z_STREAM_ERROR;
          }
        }
      strm.next_out = put;
      strm.avail_out = left;
      strm.next_in = next;
      strm.avail_in = have;
      state.hold = hold;
      state.bits = bits;
      if (state.wsize || _out !== strm.avail_out && state.mode < BAD && (state.mode < CHECK || flush !== Z_FINISH)) {
        if (updatewindow(strm, strm.output, strm.next_out, _out - strm.avail_out)) {
          state.mode = MEM;
          return Z_MEM_ERROR;
        }
      }
      _in -= strm.avail_in;
      _out -= strm.avail_out;
      strm.total_in += _in;
      strm.total_out += _out;
      state.total += _out;
      if (state.wrap && _out) {
        strm.adler = state.check = /*UPDATE(state.check, strm.next_out - _out, _out);*/
        state.flags ? crc32(state.check, output, _out, strm.next_out - _out) : adler32(state.check, output, _out, strm.next_out - _out);
      }
      strm.data_type = state.bits + (state.last ? 64 : 0) + (state.mode === TYPE ? 128 : 0) + (state.mode === LEN_ || state.mode === COPY_ ? 256 : 0);
      if ((_in === 0 && _out === 0 || flush === Z_FINISH) && ret === Z_OK) {
        ret = Z_BUF_ERROR;
      }
      return ret;
    }
    function inflateEnd(strm) {
      if (!strm || !strm.state) {
        return Z_STREAM_ERROR;
      }
      var state = strm.state;
      if (state.window) {
        state.window = null;
      }
      strm.state = null;
      return Z_OK;
    }
    function inflateGetHeader(strm, head) {
      var state;
      if (!strm || !strm.state) {
        return Z_STREAM_ERROR;
      }
      state = strm.state;
      if ((state.wrap & 2) === 0) {
        return Z_STREAM_ERROR;
      }
      state.head = head;
      head.done = false;
      return Z_OK;
    }
    function inflateSetDictionary(strm, dictionary) {
      var dictLength = dictionary.length;
      var state;
      var dictid;
      var ret;
      if (!strm || !strm.state) {
        return Z_STREAM_ERROR;
      }
      state = strm.state;
      if (state.wrap !== 0 && state.mode !== DICT) {
        return Z_STREAM_ERROR;
      }
      if (state.mode === DICT) {
        dictid = 1;
        dictid = adler32(dictid, dictionary, dictLength, 0);
        if (dictid !== state.check) {
          return Z_DATA_ERROR;
        }
      }
      ret = updatewindow(strm, dictionary, dictLength, dictLength);
      if (ret) {
        state.mode = MEM;
        return Z_MEM_ERROR;
      }
      state.havedict = 1;
      return Z_OK;
    }
    exports.inflateReset = inflateReset;
    exports.inflateReset2 = inflateReset2;
    exports.inflateResetKeep = inflateResetKeep;
    exports.inflateInit = inflateInit;
    exports.inflateInit2 = inflateInit2;
    exports.inflate = inflate;
    exports.inflateEnd = inflateEnd;
    exports.inflateGetHeader = inflateGetHeader;
    exports.inflateSetDictionary = inflateSetDictionary;
    exports.inflateInfo = "pako inflate (from Nodeca project)";
  }
});

// node_modules/pako/lib/zlib/constants.js
var require_constants = __commonJS({
  "node_modules/pako/lib/zlib/constants.js"(exports, module) {
    "use strict";
    module.exports = {
      /* Allowed flush values; see deflate() and inflate() below for details */
      Z_NO_FLUSH: 0,
      Z_PARTIAL_FLUSH: 1,
      Z_SYNC_FLUSH: 2,
      Z_FULL_FLUSH: 3,
      Z_FINISH: 4,
      Z_BLOCK: 5,
      Z_TREES: 6,
      /* Return codes for the compression/decompression functions. Negative values
      * are errors, positive values are used for special but normal events.
      */
      Z_OK: 0,
      Z_STREAM_END: 1,
      Z_NEED_DICT: 2,
      Z_ERRNO: -1,
      Z_STREAM_ERROR: -2,
      Z_DATA_ERROR: -3,
      //Z_MEM_ERROR:     -4,
      Z_BUF_ERROR: -5,
      //Z_VERSION_ERROR: -6,
      /* compression levels */
      Z_NO_COMPRESSION: 0,
      Z_BEST_SPEED: 1,
      Z_BEST_COMPRESSION: 9,
      Z_DEFAULT_COMPRESSION: -1,
      Z_FILTERED: 1,
      Z_HUFFMAN_ONLY: 2,
      Z_RLE: 3,
      Z_FIXED: 4,
      Z_DEFAULT_STRATEGY: 0,
      /* Possible values of the data_type field (though see inflate()) */
      Z_BINARY: 0,
      Z_TEXT: 1,
      //Z_ASCII:                1, // = Z_TEXT (deprecated)
      Z_UNKNOWN: 2,
      /* The deflate compression method */
      Z_DEFLATED: 8
      //Z_NULL:                 null // Use -1 or null inline, depending on var type
    };
  }
});

// node_modules/pako/lib/zlib/gzheader.js
var require_gzheader = __commonJS({
  "node_modules/pako/lib/zlib/gzheader.js"(exports, module) {
    "use strict";
    function GZheader() {
      this.text = 0;
      this.time = 0;
      this.xflags = 0;
      this.os = 0;
      this.extra = null;
      this.extra_len = 0;
      this.name = "";
      this.comment = "";
      this.hcrc = 0;
      this.done = false;
    }
    module.exports = GZheader;
  }
});

// node_modules/pako/lib/inflate.js
var require_inflate2 = __commonJS({
  "node_modules/pako/lib/inflate.js"(exports) {
    "use strict";
    var zlib_inflate = require_inflate();
    var utils = require_common();
    var strings = require_strings();
    var c = require_constants();
    var msg = require_messages();
    var ZStream = require_zstream();
    var GZheader = require_gzheader();
    var toString = Object.prototype.toString;
    function Inflate(options) {
      if (!(this instanceof Inflate)) return new Inflate(options);
      this.options = utils.assign({
        chunkSize: 16384,
        windowBits: 0,
        to: ""
      }, options || {});
      var opt = this.options;
      if (opt.raw && opt.windowBits >= 0 && opt.windowBits < 16) {
        opt.windowBits = -opt.windowBits;
        if (opt.windowBits === 0) {
          opt.windowBits = -15;
        }
      }
      if (opt.windowBits >= 0 && opt.windowBits < 16 && !(options && options.windowBits)) {
        opt.windowBits += 32;
      }
      if (opt.windowBits > 15 && opt.windowBits < 48) {
        if ((opt.windowBits & 15) === 0) {
          opt.windowBits |= 15;
        }
      }
      this.err = 0;
      this.msg = "";
      this.ended = false;
      this.chunks = [];
      this.strm = new ZStream();
      this.strm.avail_out = 0;
      var status = zlib_inflate.inflateInit2(
        this.strm,
        opt.windowBits
      );
      if (status !== c.Z_OK) {
        throw new Error(msg[status]);
      }
      this.header = new GZheader();
      zlib_inflate.inflateGetHeader(this.strm, this.header);
      if (opt.dictionary) {
        if (typeof opt.dictionary === "string") {
          opt.dictionary = strings.string2buf(opt.dictionary);
        } else if (toString.call(opt.dictionary) === "[object ArrayBuffer]") {
          opt.dictionary = new Uint8Array(opt.dictionary);
        }
        if (opt.raw) {
          status = zlib_inflate.inflateSetDictionary(this.strm, opt.dictionary);
          if (status !== c.Z_OK) {
            throw new Error(msg[status]);
          }
        }
      }
    }
    Inflate.prototype.push = function(data, mode) {
      var strm = this.strm;
      var chunkSize = this.options.chunkSize;
      var dictionary = this.options.dictionary;
      var status, _mode;
      var next_out_utf8, tail, utf8str;
      var allowBufError = false;
      if (this.ended) {
        return false;
      }
      _mode = mode === ~~mode ? mode : mode === true ? c.Z_FINISH : c.Z_NO_FLUSH;
      if (typeof data === "string") {
        strm.input = strings.binstring2buf(data);
      } else if (toString.call(data) === "[object ArrayBuffer]") {
        strm.input = new Uint8Array(data);
      } else {
        strm.input = data;
      }
      strm.next_in = 0;
      strm.avail_in = strm.input.length;
      do {
        if (strm.avail_out === 0) {
          strm.output = new utils.Buf8(chunkSize);
          strm.next_out = 0;
          strm.avail_out = chunkSize;
        }
        status = zlib_inflate.inflate(strm, c.Z_NO_FLUSH);
        if (status === c.Z_NEED_DICT && dictionary) {
          status = zlib_inflate.inflateSetDictionary(this.strm, dictionary);
        }
        if (status === c.Z_BUF_ERROR && allowBufError === true) {
          status = c.Z_OK;
          allowBufError = false;
        }
        if (status !== c.Z_STREAM_END && status !== c.Z_OK) {
          this.onEnd(status);
          this.ended = true;
          return false;
        }
        if (strm.next_out) {
          if (strm.avail_out === 0 || status === c.Z_STREAM_END || strm.avail_in === 0 && (_mode === c.Z_FINISH || _mode === c.Z_SYNC_FLUSH)) {
            if (this.options.to === "string") {
              next_out_utf8 = strings.utf8border(strm.output, strm.next_out);
              tail = strm.next_out - next_out_utf8;
              utf8str = strings.buf2string(strm.output, next_out_utf8);
              strm.next_out = tail;
              strm.avail_out = chunkSize - tail;
              if (tail) {
                utils.arraySet(strm.output, strm.output, next_out_utf8, tail, 0);
              }
              this.onData(utf8str);
            } else {
              this.onData(utils.shrinkBuf(strm.output, strm.next_out));
            }
          }
        }
        if (strm.avail_in === 0 && strm.avail_out === 0) {
          allowBufError = true;
        }
      } while ((strm.avail_in > 0 || strm.avail_out === 0) && status !== c.Z_STREAM_END);
      if (status === c.Z_STREAM_END) {
        _mode = c.Z_FINISH;
      }
      if (_mode === c.Z_FINISH) {
        status = zlib_inflate.inflateEnd(this.strm);
        this.onEnd(status);
        this.ended = true;
        return status === c.Z_OK;
      }
      if (_mode === c.Z_SYNC_FLUSH) {
        this.onEnd(c.Z_OK);
        strm.avail_out = 0;
        return true;
      }
      return true;
    };
    Inflate.prototype.onData = function(chunk) {
      this.chunks.push(chunk);
    };
    Inflate.prototype.onEnd = function(status) {
      if (status === c.Z_OK) {
        if (this.options.to === "string") {
          this.result = this.chunks.join("");
        } else {
          this.result = utils.flattenChunks(this.chunks);
        }
      }
      this.chunks = [];
      this.err = status;
      this.msg = this.strm.msg;
    };
    function inflate(input, options) {
      var inflator = new Inflate(options);
      inflator.push(input, true);
      if (inflator.err) {
        throw inflator.msg || msg[inflator.err];
      }
      return inflator.result;
    }
    function inflateRaw(input, options) {
      options = options || {};
      options.raw = true;
      return inflate(input, options);
    }
    exports.Inflate = Inflate;
    exports.inflate = inflate;
    exports.inflateRaw = inflateRaw;
    exports.ungzip = inflate;
  }
});

// node_modules/pako/index.js
var require_pako = __commonJS({
  "node_modules/pako/index.js"(exports, module) {
    "use strict";
    var assign = require_common().assign;
    var deflate = require_deflate2();
    var inflate = require_inflate2();
    var constants = require_constants();
    var pako = {};
    assign(pako, deflate, inflate, constants);
    module.exports = pako;
  }
});

// node_modules/utif/UTIF.js
var require_UTIF = __commonJS({
  "node_modules/utif/UTIF.js"(exports, module) {
    (function() {
      var UTIF = {};
      if (typeof module == "object") {
        module.exports = UTIF;
      } else {
        self.UTIF = UTIF;
      }
      var pako;
      if (typeof __require == "function") {
        pako = require_pako();
      } else {
        pako = self.pako;
      }
      function log() {
        if (typeof process == "undefined" || true) console.log.apply(console, arguments);
      }
      (function(UTIF2, pako2) {
        (function() {
          var V = "function" === typeof Symbol && "symbol" === typeof Symbol.iterator ? function(g) {
            return typeof g;
          } : function(g) {
            return g && "function" === typeof Symbol && g.constructor === Symbol && g !== Symbol.prototype ? "symbol" : typeof g;
          }, D = (function() {
            function g(g2) {
              this.message = "JPEG error: " + g2;
            }
            g.prototype = Error();
            g.prototype.name = "JpegError";
            return g.constructor = g;
          })(), P = (function() {
            function g(g2, D2) {
              this.message = g2;
              this.g = D2;
            }
            g.prototype = Error();
            g.prototype.name = "DNLMarkerError";
            return g.constructor = g;
          })();
          (function() {
            function g() {
              this.M = null;
              this.B = -1;
            }
            function W(a, d) {
              for (var f = 0, e = [], b, B, k = 16; 0 < k && !a[k - 1]; ) k--;
              e.push({ children: [], index: 0 });
              var l = e[0], r;
              for (b = 0; b < k; b++) {
                for (B = 0; B < a[b]; B++) {
                  l = e.pop();
                  for (l.children[l.index] = d[f]; 0 < l.index; ) l = e.pop();
                  l.index++;
                  for (e.push(l); e.length <= b; ) e.push(r = { children: [], index: 0 }), l.children[l.index] = r.children, l = r;
                  f++;
                }
                b + 1 < k && (e.push(r = { children: [], index: 0 }), l.children[l.index] = r.children, l = r);
              }
              return e[0].children;
            }
            function X(a, d, f, e, b, B, k, l, r) {
              function n() {
                if (0 < x) return x--, z >> x & 1;
                z = a[d++];
                if (255 === z) {
                  var c2 = a[d++];
                  if (c2) {
                    if (220 === c2 && g2) {
                      d += 2;
                      var b2 = a[d++] << 8 | a[d++];
                      if (0 < b2 && b2 !== f.g) throw new P("Found DNL marker (0xFFDC) while parsing scan data", b2);
                    }
                    throw new D("unexpected marker " + (z << 8 | c2).toString(16));
                  }
                }
                x = 7;
                return z >>> 7;
              }
              function q(a2) {
                for (; ; ) {
                  a2 = a2[n()];
                  if ("number" === typeof a2) return a2;
                  if ("object" !== ("undefined" === typeof a2 ? "undefined" : V(a2))) throw new D("invalid huffman sequence");
                }
              }
              function h(a2) {
                for (var c2 = 0; 0 < a2; ) c2 = c2 << 1 | n(), a2--;
                return c2;
              }
              function c(a2) {
                if (1 === a2) return 1 === n() ? 1 : -1;
                var c2 = h(a2);
                return c2 >= 1 << a2 - 1 ? c2 : c2 + (-1 << a2) + 1;
              }
              function C(a2, b2) {
                var d2 = q(a2.D);
                d2 = 0 === d2 ? 0 : c(d2);
                a2.a[b2] = a2.m += d2;
                for (d2 = 1; 64 > d2; ) {
                  var h2 = q(a2.o), k2 = h2 & 15;
                  h2 >>= 4;
                  if (0 === k2) {
                    if (15 > h2) break;
                    d2 += 16;
                  } else d2 += h2, a2.a[b2 + J[d2]] = c(k2), d2++;
                }
              }
              function w(a2, d2) {
                var b2 = q(a2.D);
                b2 = 0 === b2 ? 0 : c(b2) << r;
                a2.a[d2] = a2.m += b2;
              }
              function p(a2, c2) {
                a2.a[c2] |= n() << r;
              }
              function m(a2, b2) {
                if (0 < A) A--;
                else for (var d2 = B; d2 <= k; ) {
                  var e2 = q(a2.o), f2 = e2 & 15;
                  e2 >>= 4;
                  if (0 === f2) {
                    if (15 > e2) {
                      A = h(e2) + (1 << e2) - 1;
                      break;
                    }
                    d2 += 16;
                  } else d2 += e2, a2.a[b2 + J[d2]] = c(f2) * (1 << r), d2++;
                }
              }
              function t(a2, d2) {
                for (var b2 = B, e2 = 0, f2; b2 <= k; ) {
                  f2 = d2 + J[b2];
                  var l2 = 0 > a2.a[f2] ? -1 : 1;
                  switch (E) {
                    case 0:
                      e2 = q(a2.o);
                      f2 = e2 & 15;
                      e2 >>= 4;
                      if (0 === f2) 15 > e2 ? (A = h(e2) + (1 << e2), E = 4) : (e2 = 16, E = 1);
                      else {
                        if (1 !== f2) throw new D("invalid ACn encoding");
                        Q = c(f2);
                        E = e2 ? 2 : 3;
                      }
                      continue;
                    case 1:
                    case 2:
                      a2.a[f2] ? a2.a[f2] += l2 * (n() << r) : (e2--, 0 === e2 && (E = 2 === E ? 3 : 0));
                      break;
                    case 3:
                      a2.a[f2] ? a2.a[f2] += l2 * (n() << r) : (a2.a[f2] = Q << r, E = 0);
                      break;
                    case 4:
                      a2.a[f2] && (a2.a[f2] += l2 * (n() << r));
                  }
                  b2++;
                }
                4 === E && (A--, 0 === A && (E = 0));
              }
              var g2 = 9 < arguments.length && void 0 !== arguments[9] ? arguments[9] : false, u = f.P, v = d, z = 0, x = 0, A = 0, E = 0, Q, K = e.length, F, L, M, I;
              var R = f.S ? 0 === B ? 0 === l ? w : p : 0 === l ? m : t : C;
              var G = 0;
              var O = 1 === K ? e[0].c * e[0].l : u * f.O;
              for (var S, T; G < O; ) {
                var U = b ? Math.min(O - G, b) : O;
                for (F = 0; F < K; F++) e[F].m = 0;
                A = 0;
                if (1 === K) {
                  var y = e[0];
                  for (I = 0; I < U; I++) R(y, 64 * ((y.c + 1) * (G / y.c | 0) + G % y.c)), G++;
                } else for (I = 0; I < U; I++) {
                  for (F = 0; F < K; F++) for (y = e[F], S = y.h, T = y.j, L = 0; L < T; L++) for (M = 0; M < S; M++) R(y, 64 * ((y.c + 1) * ((G / u | 0) * y.j + L) + (G % u * y.h + M)));
                  G++;
                }
                x = 0;
                (y = N(a, d)) && y.f && ((0, _util.warn)("decodeScan - unexpected MCU data, current marker is: " + y.f), d = y.offset);
                y = y && y.F;
                if (!y || 65280 >= y) throw new D("marker was not found");
                if (65488 <= y && 65495 >= y) d += 2;
                else break;
              }
              (y = N(a, d)) && y.f && ((0, _util.warn)("decodeScan - unexpected Scan data, current marker is: " + y.f), d = y.offset);
              return d - v;
            }
            function Y(a, d) {
              for (var f = d.c, e = d.l, b = new Int16Array(64), B = 0; B < e; B++) for (var k = 0; k < f; k++) {
                var l = 64 * ((d.c + 1) * B + k), r = b, n = d.G, q = d.a;
                if (!n) throw new D("missing required Quantization Table.");
                for (var h = 0; 64 > h; h += 8) {
                  var c = q[l + h];
                  var C = q[l + h + 1];
                  var w = q[l + h + 2];
                  var p = q[l + h + 3];
                  var m = q[l + h + 4];
                  var t = q[l + h + 5];
                  var g2 = q[l + h + 6];
                  var u = q[l + h + 7];
                  c *= n[h];
                  if (0 === (C | w | p | m | t | g2 | u)) c = 5793 * c + 512 >> 10, r[h] = c, r[h + 1] = c, r[h + 2] = c, r[h + 3] = c, r[h + 4] = c, r[h + 5] = c, r[h + 6] = c, r[h + 7] = c;
                  else {
                    C *= n[h + 1];
                    w *= n[h + 2];
                    p *= n[h + 3];
                    m *= n[h + 4];
                    t *= n[h + 5];
                    g2 *= n[h + 6];
                    u *= n[h + 7];
                    var v = 5793 * c + 128 >> 8;
                    var z = 5793 * m + 128 >> 8;
                    var x = w;
                    var A = g2;
                    m = 2896 * (C - u) + 128 >> 8;
                    u = 2896 * (C + u) + 128 >> 8;
                    p <<= 4;
                    t <<= 4;
                    v = v + z + 1 >> 1;
                    z = v - z;
                    c = 3784 * x + 1567 * A + 128 >> 8;
                    x = 1567 * x - 3784 * A + 128 >> 8;
                    A = c;
                    m = m + t + 1 >> 1;
                    t = m - t;
                    u = u + p + 1 >> 1;
                    p = u - p;
                    v = v + A + 1 >> 1;
                    A = v - A;
                    z = z + x + 1 >> 1;
                    x = z - x;
                    c = 2276 * m + 3406 * u + 2048 >> 12;
                    m = 3406 * m - 2276 * u + 2048 >> 12;
                    u = c;
                    c = 799 * p + 4017 * t + 2048 >> 12;
                    p = 4017 * p - 799 * t + 2048 >> 12;
                    t = c;
                    r[h] = v + u;
                    r[h + 7] = v - u;
                    r[h + 1] = z + t;
                    r[h + 6] = z - t;
                    r[h + 2] = x + p;
                    r[h + 5] = x - p;
                    r[h + 3] = A + m;
                    r[h + 4] = A - m;
                  }
                }
                for (n = 0; 8 > n; ++n) c = r[n], C = r[n + 8], w = r[n + 16], p = r[n + 24], m = r[n + 32], t = r[n + 40], g2 = r[n + 48], u = r[n + 56], 0 === (C | w | p | m | t | g2 | u) ? (c = 5793 * c + 8192 >> 14, c = -2040 > c ? 0 : 2024 <= c ? 255 : c + 2056 >> 4, q[l + n] = c, q[l + n + 8] = c, q[l + n + 16] = c, q[l + n + 24] = c, q[l + n + 32] = c, q[l + n + 40] = c, q[l + n + 48] = c, q[l + n + 56] = c) : (v = 5793 * c + 2048 >> 12, z = 5793 * m + 2048 >> 12, x = w, A = g2, m = 2896 * (C - u) + 2048 >> 12, u = 2896 * (C + u) + 2048 >> 12, v = (v + z + 1 >> 1) + 4112, z = v - z, c = 3784 * x + 1567 * A + 2048 >> 12, x = 1567 * x - 3784 * A + 2048 >> 12, A = c, m = m + t + 1 >> 1, t = m - t, u = u + p + 1 >> 1, p = u - p, v = v + A + 1 >> 1, A = v - A, z = z + x + 1 >> 1, x = z - x, c = 2276 * m + 3406 * u + 2048 >> 12, m = 3406 * m - 2276 * u + 2048 >> 12, u = c, c = 799 * p + 4017 * t + 2048 >> 12, p = 4017 * p - 799 * t + 2048 >> 12, t = c, c = v + u, u = v - u, C = z + t, g2 = z - t, w = x + p, t = x - p, p = A + m, m = A - m, c = 16 > c ? 0 : 4080 <= c ? 255 : c >> 4, C = 16 > C ? 0 : 4080 <= C ? 255 : C >> 4, w = 16 > w ? 0 : 4080 <= w ? 255 : w >> 4, p = 16 > p ? 0 : 4080 <= p ? 255 : p >> 4, m = 16 > m ? 0 : 4080 <= m ? 255 : m >> 4, t = 16 > t ? 0 : 4080 <= t ? 255 : t >> 4, g2 = 16 > g2 ? 0 : 4080 <= g2 ? 255 : g2 >> 4, u = 16 > u ? 0 : 4080 <= u ? 255 : u >> 4, q[l + n] = c, q[l + n + 8] = C, q[l + n + 16] = w, q[l + n + 24] = p, q[l + n + 32] = m, q[l + n + 40] = t, q[l + n + 48] = g2, q[l + n + 56] = u);
              }
              return d.a;
            }
            function N(a, d) {
              var f = 2 < arguments.length && void 0 !== arguments[2] ? arguments[2] : d, e = a.length - 1;
              f = f < d ? f : d;
              if (d >= e) return null;
              var b = a[d] << 8 | a[d + 1];
              if (65472 <= b && 65534 >= b) return { f: null, F: b, offset: d };
              for (var B = a[f] << 8 | a[f + 1]; !(65472 <= B && 65534 >= B); ) {
                if (++f >= e) return null;
                B = a[f] << 8 | a[f + 1];
              }
              return { f: b.toString(16), F: B, offset: f };
            }
            var J = new Uint8Array([
              0,
              1,
              8,
              16,
              9,
              2,
              3,
              10,
              17,
              24,
              32,
              25,
              18,
              11,
              4,
              5,
              12,
              19,
              26,
              33,
              40,
              48,
              41,
              34,
              27,
              20,
              13,
              6,
              7,
              14,
              21,
              28,
              35,
              42,
              49,
              56,
              57,
              50,
              43,
              36,
              29,
              22,
              15,
              23,
              30,
              37,
              44,
              51,
              58,
              59,
              52,
              45,
              38,
              31,
              39,
              46,
              53,
              60,
              61,
              54,
              47,
              55,
              62,
              63
            ]);
            g.prototype = { parse: function(a) {
              function d() {
                var d2 = a[k] << 8 | a[k + 1];
                k += 2;
                return d2;
              }
              function f() {
                var b2 = d();
                b2 = k + b2 - 2;
                var c2 = N(a, b2, k);
                c2 && c2.f && ((0, _util.warn)("readDataBlock - incorrect length, current marker is: " + c2.f), b2 = c2.offset);
                b2 = a.subarray(k, b2);
                k += b2.length;
                return b2;
              }
              function e(a2) {
                for (var b2 = Math.ceil(a2.v / 8 / a2.s), c2 = Math.ceil(a2.g / 8 / a2.u), d2 = 0; d2 < a2.b.length; d2++) {
                  v = a2.b[d2];
                  var e2 = Math.ceil(Math.ceil(a2.v / 8) * v.h / a2.s), f2 = Math.ceil(Math.ceil(a2.g / 8) * v.j / a2.u);
                  v.a = new Int16Array(64 * c2 * v.j * (b2 * v.h + 1));
                  v.c = e2;
                  v.l = f2;
                }
                a2.P = b2;
                a2.O = c2;
              }
              var b = (1 < arguments.length && void 0 !== arguments[1] ? arguments[1] : {}).N, B = void 0 === b ? null : b, k = 0, l = null, r = 0;
              b = [];
              var n = [], q = [], h = d();
              if (65496 !== h) throw new D("SOI not found");
              for (h = d(); 65497 !== h; ) {
                switch (h) {
                  case 65504:
                  case 65505:
                  case 65506:
                  case 65507:
                  case 65508:
                  case 65509:
                  case 65510:
                  case 65511:
                  case 65512:
                  case 65513:
                  case 65514:
                  case 65515:
                  case 65516:
                  case 65517:
                  case 65518:
                  case 65519:
                  case 65534:
                    var c = f();
                    65518 === h && 65 === c[0] && 100 === c[1] && 111 === c[2] && 98 === c[3] && 101 === c[4] && (l = { version: c[5] << 8 | c[6], Y: c[7] << 8 | c[8], Z: c[9] << 8 | c[10], W: c[11] });
                    break;
                  case 65499:
                    h = d() + k - 2;
                    for (var g2; k < h; ) {
                      var w = a[k++], p = new Uint16Array(64);
                      if (0 === w >> 4) for (c = 0; 64 > c; c++) g2 = J[c], p[g2] = a[k++];
                      else if (1 === w >> 4) for (c = 0; 64 > c; c++) g2 = J[c], p[g2] = d();
                      else throw new D("DQT - invalid table spec");
                      b[w & 15] = p;
                    }
                    break;
                  case 65472:
                  case 65473:
                  case 65474:
                    if (m) throw new D("Only single frame JPEGs supported");
                    d();
                    var m = {};
                    m.X = 65473 === h;
                    m.S = 65474 === h;
                    m.precision = a[k++];
                    h = d();
                    m.g = B || h;
                    m.v = d();
                    m.b = [];
                    m.C = {};
                    c = a[k++];
                    for (h = p = w = 0; h < c; h++) {
                      g2 = a[k];
                      var t = a[k + 1] >> 4;
                      var H = a[k + 1] & 15;
                      w < t && (w = t);
                      p < H && (p = H);
                      t = m.b.push({ h: t, j: H, T: a[k + 2], G: null });
                      m.C[g2] = t - 1;
                      k += 3;
                    }
                    m.s = w;
                    m.u = p;
                    e(m);
                    break;
                  case 65476:
                    g2 = d();
                    for (h = 2; h < g2; ) {
                      w = a[k++];
                      p = new Uint8Array(16);
                      for (c = t = 0; 16 > c; c++, k++) t += p[c] = a[k];
                      H = new Uint8Array(t);
                      for (c = 0; c < t; c++, k++) H[c] = a[k];
                      h += 17 + t;
                      (0 === w >> 4 ? q : n)[w & 15] = W(p, H);
                    }
                    break;
                  case 65501:
                    d();
                    var u = d();
                    break;
                  case 65498:
                    c = 1 === ++r && !B;
                    d();
                    w = a[k++];
                    g2 = [];
                    for (h = 0; h < w; h++) {
                      p = m.C[a[k++]];
                      var v = m.b[p];
                      p = a[k++];
                      v.D = q[p >> 4];
                      v.o = n[p & 15];
                      g2.push(v);
                    }
                    h = a[k++];
                    w = a[k++];
                    p = a[k++];
                    try {
                      var z = X(a, k, m, g2, u, h, w, p >> 4, p & 15, c);
                      k += z;
                    } catch (x) {
                      if (x instanceof P) return (0, _util.warn)('Attempting to re-parse JPEG image using "scanLines" parameter found in DNL marker (0xFFDC) segment.'), this.parse(a, { N: x.g });
                      throw x;
                    }
                    break;
                  case 65500:
                    k += 4;
                    break;
                  case 65535:
                    255 !== a[k] && k--;
                    break;
                  default:
                    if (255 === a[k - 3] && 192 <= a[k - 2] && 254 >= a[k - 2]) k -= 3;
                    else if ((c = N(a, k - 2)) && c.f) (0, _util.warn)("JpegImage.parse - unexpected data, current marker is: " + c.f), k = c.offset;
                    else throw new D("unknown marker " + h.toString(16));
                }
                h = d();
              }
              this.width = m.v;
              this.height = m.g;
              this.A = l;
              this.b = [];
              for (h = 0; h < m.b.length; h++) {
                v = m.b[h];
                if (u = b[v.T]) v.G = u;
                this.b.push({ R: Y(m, v), U: v.h / m.s, V: v.j / m.u, c: v.c, l: v.l });
              }
              this.i = this.b.length;
            }, L: function(a, d) {
              var f = this.width / a, e = this.height / d, b, g2, k = this.b.length, l = a * d * k, r = new Uint8ClampedArray(l), n = new Uint32Array(a);
              for (g2 = 0; g2 < k; g2++) {
                var q = this.b[g2];
                var h = q.U * f;
                var c = q.V * e;
                var C = g2;
                var w = q.R;
                var p = q.c + 1 << 3;
                for (b = 0; b < a; b++) q = 0 | b * h, n[b] = (q & 4294967288) << 3 | q & 7;
                for (h = 0; h < d; h++) for (q = 0 | h * c, q = p * (q & 4294967288) | (q & 7) << 3, b = 0; b < a; b++) r[C] = w[q + n[b]], C += k;
              }
              if (e = this.M) for (g2 = 0; g2 < l; ) for (f = q = 0; q < k; q++, g2++, f += 2) r[g2] = (r[g2] * e[f] >> 8) + e[f + 1];
              return r;
            }, w: function() {
              return this.A ? !!this.A.W : 3 === this.i ? 0 === this.B ? false : true : 1 === this.B ? true : false;
            }, I: function(a) {
              for (var d, f, e, b = 0, g2 = a.length; b < g2; b += 3) d = a[b], f = a[b + 1], e = a[b + 2], a[b] = d - 179.456 + 1.402 * e, a[b + 1] = d + 135.459 - 0.344 * f - 0.714 * e, a[b + 2] = d - 226.816 + 1.772 * f;
              return a;
            }, K: function(a) {
              for (var d, f, e, b, g2 = 0, k = 0, l = a.length; k < l; k += 4) d = a[k], f = a[k + 1], e = a[k + 2], b = a[k + 3], a[g2++] = -122.67195406894 + f * (-660635669420364e-19 * f + 437130475926232e-18 * e - 54080610064599e-18 * d + 48449797120281e-17 * b - 0.154362151871126) + e * (-957964378445773e-18 * e + 817076911346625e-18 * d - 0.00477271405408747 * b + 1.53380253221734) + d * (961250184130688e-18 * d - 0.00266257332283933 * b + 0.48357088451265) + b * (-336197177618394e-18 * b + 0.484791561490776), a[g2++] = 107.268039397724 + f * (219927104525741e-19 * f - 640992018297945e-18 * e + 659397001245577e-18 * d + 426105652938837e-18 * b - 0.176491792462875) + e * (-778269941513683e-18 * e + 0.00130872261408275 * d + 770482631801132e-18 * b - 0.151051492775562) + d * (0.00126935368114843 * d - 0.00265090189010898 * b + 0.25802910206845) + b * (-318913117588328e-18 * b - 0.213742400323665), a[g2++] = -20.810012546947 + f * (-570115196973677e-18 * f - 263409051004589e-19 * e + 0.0020741088115012 * d - 0.00288260236853442 * b + 0.814272968359295) + e * (-153496057440975e-19 * e - 132689043961446e-18 * d + 560833691242812e-18 * b - 0.195152027534049) + d * (0.00174418132927582 * d - 0.00255243321439347 * b + 0.116935020465145) + b * (-343531996510555e-18 * b + 0.24165260232407);
              return a.subarray(
                0,
                g2
              );
            }, J: function(a) {
              for (var d, f, e, b = 0, g2 = a.length; b < g2; b += 4) d = a[b], f = a[b + 1], e = a[b + 2], a[b] = 434.456 - d - 1.402 * e, a[b + 1] = 119.541 - d + 0.344 * f + 0.714 * e, a[b + 2] = 481.816 - d - 1.772 * f;
              return a;
            }, H: function(a) {
              for (var d, f, e, b, g2 = 0, k = 1 / 255, l = 0, r = a.length; l < r; l += 4) d = a[l] * k, f = a[l + 1] * k, e = a[l + 2] * k, b = a[l + 3] * k, a[g2++] = 255 + d * (-4.387332384609988 * d + 54.48615194189176 * f + 18.82290502165302 * e + 212.25662451639585 * b - 285.2331026137004) + f * (1.7149763477362134 * f - 5.6096736904047315 * e - 17.873870861415444 * b - 5.497006427196366) + e * (-2.5217340131683033 * e - 21.248923337353073 * b + 17.5119270841813) - b * (21.86122147463605 * b + 189.48180835922747), a[g2++] = 255 + d * (8.841041422036149 * d + 60.118027045597366 * f + 6.871425592049007 * e + 31.159100130055922 * b - 79.2970844816548) + f * (-15.310361306967817 * f + 17.575251261109482 * e + 131.35250912493976 * b - 190.9453302588951) + e * (4.444339102852739 * e + 9.8632861493405 * b - 24.86741582555878) - b * (20.737325471181034 * b + 187.80453709719578), a[g2++] = 255 + d * (0.8842522430003296 * d + 8.078677503112928 * f + 30.89978309703729 * e - 0.23883238689178934 * b - 14.183576799673286) + f * (10.49593273432072 * f + 63.02378494754052 * e + 50.606957656360734 * b - 112.23884253719248) + e * (0.03296041114873217 * e + 115.60384449646641 * b - 193.58209356861505) - b * (22.33816807309886 * b + 180.12613974708367);
              return a.subarray(0, g2);
            }, getData: function(a, d, f) {
              if (4 < this.i) throw new D("Unsupported color mode");
              a = this.L(a, d);
              if (1 === this.i && f) {
                f = a.length;
                d = new Uint8ClampedArray(3 * f);
                for (var e = 0, b = 0; b < f; b++) {
                  var g2 = a[b];
                  d[e++] = g2;
                  d[e++] = g2;
                  d[e++] = g2;
                }
                return d;
              }
              if (3 === this.i && this.w()) return this.I(a);
              if (4 === this.i) {
                if (this.w()) return f ? this.K(a) : this.J(a);
                if (f) return this.H(a);
              }
              return a;
            } };
            UTIF2.JpegDecoder = g;
          })();
        })();
        UTIF2.encodeImage = function(rgba, w, h, metadata) {
          var idf = {
            "t256": [w],
            "t257": [h],
            "t258": [8, 8, 8, 8],
            "t259": [1],
            "t262": [2],
            "t273": [1e3],
            // strips offset
            "t277": [4],
            "t278": [h],
            /* rows per strip */
            "t279": [w * h * 4],
            // strip byte counts
            "t282": [1],
            "t283": [1],
            "t284": [1],
            "t286": [0],
            "t287": [0],
            "t296": [1],
            "t305": ["Photopea (UTIF.js)"],
            "t338": [1]
          };
          if (metadata) for (var i in metadata) idf[i] = metadata[i];
          var prfx = new Uint8Array(UTIF2.encode([idf]));
          var img = new Uint8Array(rgba);
          var data = new Uint8Array(1e3 + w * h * 4);
          for (var i = 0; i < prfx.length; i++) data[i] = prfx[i];
          for (var i = 0; i < img.length; i++) data[1e3 + i] = img[i];
          return data.buffer;
        };
        UTIF2.encode = function(ifds) {
          var data = new Uint8Array(2e4), offset = 4, bin = UTIF2._binBE;
          data[0] = 77;
          data[1] = 77;
          data[3] = 42;
          var ifdo = 8;
          bin.writeUint(data, offset, ifdo);
          offset += 4;
          for (var i = 0; i < ifds.length; i++) {
            var noffs = UTIF2._writeIFD(bin, data, ifdo, ifds[i]);
            ifdo = noffs[1];
            if (i < ifds.length - 1) bin.writeUint(data, noffs[0], ifdo);
          }
          return data.slice(0, ifdo).buffer;
        };
        UTIF2.decode = function(buff) {
          UTIF2.decode._decodeG3.allow2D = null;
          var data = new Uint8Array(buff), offset = 0;
          var id = UTIF2._binBE.readASCII(data, offset, 2);
          offset += 2;
          var bin = id == "II" ? UTIF2._binLE : UTIF2._binBE;
          var num = bin.readUshort(data, offset);
          offset += 2;
          var ifdo = bin.readUint(data, offset);
          offset += 4;
          var ifds = [];
          while (true) {
            var noff = UTIF2._readIFD(bin, data, ifdo, ifds, 0, false);
            ifdo = bin.readUint(data, noff);
            if (ifdo == 0) break;
          }
          return ifds;
        };
        UTIF2.decodeImage = function(buff, img, ifds) {
          var data = new Uint8Array(buff);
          var id = UTIF2._binBE.readASCII(data, 0, 2);
          if (img["t256"] == null) return;
          img.isLE = id == "II";
          img.width = img["t256"][0];
          img.height = img["t257"][0];
          var cmpr = img["t259"] ? img["t259"][0] : 1;
          var fo = img["t266"] ? img["t266"][0] : 1;
          if (img["t284"] && img["t284"][0] == 2) log("PlanarConfiguration 2 should not be used!");
          var bipp;
          if (img["t258"]) bipp = Math.min(32, img["t258"][0]) * img["t258"].length;
          else bipp = img["t277"] ? img["t277"][0] : 1;
          if (cmpr == 1 && img["t279"] != null && img["t278"] && img["t262"][0] == 32803) {
            bipp = Math.round(img["t279"][0] * 8 / (img.width * img["t278"][0]));
          }
          var bipl = Math.ceil(img.width * bipp / 8) * 8;
          var soff = img["t273"];
          if (soff == null) soff = img["t324"];
          var bcnt = img["t279"];
          if (cmpr == 1 && soff.length == 1) bcnt = [img.height * (bipl >>> 3)];
          if (bcnt == null) bcnt = img["t325"];
          var bytes = new Uint8Array(img.height * (bipl >>> 3)), bilen = 0;
          if (img["t322"] != null) {
            var tw = img["t322"][0], th = img["t323"][0];
            var tx = Math.floor((img.width + tw - 1) / tw);
            var ty = Math.floor((img.height + th - 1) / th);
            var tbuff = new Uint8Array(Math.ceil(tw * th * bipp / 8) | 0);
            for (var y = 0; y < ty; y++)
              for (var x = 0; x < tx; x++) {
                var i = y * tx + x;
                for (var j = 0; j < tbuff.length; j++) tbuff[j] = 0;
                UTIF2.decode._decompress(img, ifds, data, soff[i], bcnt[i], cmpr, tbuff, 0, fo);
                if (cmpr == 6) bytes = tbuff;
                else UTIF2._copyTile(tbuff, Math.ceil(tw * bipp / 8) | 0, th, bytes, Math.ceil(img.width * bipp / 8) | 0, img.height, Math.ceil(x * tw * bipp / 8) | 0, y * th);
              }
            bilen = bytes.length * 8;
          } else {
            var rps = img["t278"] ? img["t278"][0] : img.height;
            rps = Math.min(rps, img.height);
            for (var i = 0; i < soff.length; i++) {
              UTIF2.decode._decompress(img, ifds, data, soff[i], bcnt[i], cmpr, bytes, Math.ceil(bilen / 8) | 0, fo);
              bilen += bipl * rps;
            }
            bilen = Math.min(bilen, bytes.length * 8);
          }
          img.data = new Uint8Array(bytes.buffer, 0, Math.ceil(bilen / 8) | 0);
        };
        UTIF2.decode._decompress = function(img, ifds, data, off, len, cmpr, tgt, toff, fo) {
          if (false) {
          } else if (cmpr == 1 || len == tgt.length && cmpr != 32767) for (var j = 0; j < len; j++) tgt[toff + j] = data[off + j];
          else if (cmpr == 3) UTIF2.decode._decodeG3(data, off, len, tgt, toff, img.width, fo);
          else if (cmpr == 4) UTIF2.decode._decodeG4(data, off, len, tgt, toff, img.width, fo);
          else if (cmpr == 5) UTIF2.decode._decodeLZW(data, off, tgt, toff);
          else if (cmpr == 6) UTIF2.decode._decodeOldJPEG(img, data, off, len, tgt, toff);
          else if (cmpr == 7) UTIF2.decode._decodeNewJPEG(img, data, off, len, tgt, toff);
          else if (cmpr == 8) {
            var src = new Uint8Array(data.buffer, off, len);
            var bin = pako2["inflate"](src);
            for (var i = 0; i < bin.length; i++) tgt[toff + i] = bin[i];
          } else if (cmpr == 32767) UTIF2.decode._decodeARW(img, data, off, len, tgt, toff);
          else if (cmpr == 32773) UTIF2.decode._decodePackBits(data, off, len, tgt, toff);
          else if (cmpr == 32809) UTIF2.decode._decodeThunder(data, off, len, tgt, toff);
          else if (cmpr == 34713)
            UTIF2.decode._decodeNikon(img, ifds, data, off, len, tgt, toff);
          else log("Unknown compression", cmpr);
          var bps = img["t258"] ? Math.min(32, img["t258"][0]) : 1;
          var noc = img["t277"] ? img["t277"][0] : 1, bpp = bps * noc >>> 3, h = img["t278"] ? img["t278"][0] : img.height, bpl = Math.ceil(bps * noc * img.width / 8);
          if (bps == 16 && !img.isLE && img["t33422"] == null)
            for (var y = 0; y < h; y++) {
              var roff = toff + y * bpl;
              for (var x = 1; x < bpl; x += 2) {
                var t = tgt[roff + x];
                tgt[roff + x] = tgt[roff + x - 1];
                tgt[roff + x - 1] = t;
              }
            }
          if (img["t317"] && img["t317"][0] == 2) {
            for (var y = 0; y < h; y++) {
              var ntoff = toff + y * bpl;
              if (bps == 16) for (var j = bpp; j < bpl; j += 2) {
                var nv = (tgt[ntoff + j + 1] << 8 | tgt[ntoff + j]) + (tgt[ntoff + j - bpp + 1] << 8 | tgt[ntoff + j - bpp]);
                tgt[ntoff + j] = nv & 255;
                tgt[ntoff + j + 1] = nv >>> 8 & 255;
              }
              else if (noc == 3) for (var j = 3; j < bpl; j += 3) {
                tgt[ntoff + j] = tgt[ntoff + j] + tgt[ntoff + j - 3] & 255;
                tgt[ntoff + j + 1] = tgt[ntoff + j + 1] + tgt[ntoff + j - 2] & 255;
                tgt[ntoff + j + 2] = tgt[ntoff + j + 2] + tgt[ntoff + j - 1] & 255;
              }
              else for (var j = bpp; j < bpl; j++) tgt[ntoff + j] = tgt[ntoff + j] + tgt[ntoff + j - bpp] & 255;
            }
          }
        };
        UTIF2.decode._ljpeg_diff = function(data, prm, huff) {
          var getbithuff = UTIF2.decode._getbithuff;
          var len, diff;
          len = getbithuff(data, prm, huff[0], huff);
          diff = getbithuff(data, prm, len, 0);
          if ((diff & 1 << len - 1) == 0) diff -= (1 << len) - 1;
          return diff;
        };
        UTIF2.decode._decodeARW = function(img, inp, off, src_length, tgt, toff) {
          var raw_width = img["t256"][0], height = img["t257"][0], tiff_bps = img["t258"][0];
          var bin = img.isLE ? UTIF2._binLE : UTIF2._binBE;
          var arw2 = raw_width * height == src_length || raw_width * height * 1.5 == src_length;
          if (!arw2) {
            height += 8;
            var prm = [off, 0, 0, 0];
            var huff = new Uint16Array(32770);
            var tab = [
              3857,
              3856,
              3599,
              3342,
              3085,
              2828,
              2571,
              2314,
              2057,
              1800,
              1543,
              1286,
              1029,
              772,
              771,
              768,
              514,
              513
            ];
            var i, c, n, col, row, sum = 0;
            var ljpeg_diff = UTIF2.decode._ljpeg_diff;
            huff[0] = 15;
            for (n = i = 0; i < 18; i++) {
              var lim = 32768 >>> (tab[i] >>> 8);
              for (var c = 0; c < lim; c++) huff[++n] = tab[i];
            }
            for (col = raw_width; col--; )
              for (row = 0; row < height + 1; row += 2) {
                if (row == height) row = 1;
                sum += ljpeg_diff(inp, prm, huff);
                if (row < height) {
                  var clr = sum & 4095;
                  UTIF2.decode._putsF(tgt, (row * raw_width + col) * tiff_bps, clr << 16 - tiff_bps);
                }
              }
            return;
          }
          if (raw_width * height * 1.5 == src_length) {
            for (var i = 0; i < src_length; i += 3) {
              var b0 = inp[off + i + 0], b1 = inp[off + i + 1], b2 = inp[off + i + 2];
              tgt[toff + i] = b1 << 4 | b0 >>> 4;
              tgt[toff + i + 1] = b0 << 4 | b2 >>> 4;
              tgt[toff + i + 2] = b2 << 4 | b1 >>> 4;
            }
            return;
          }
          var pix = new Uint16Array(16);
          var row, col, val, max, min, imax, imin, sh, bit, i, dp;
          var data = new Uint8Array(raw_width + 1);
          for (row = 0; row < height; row++) {
            for (var j = 0; j < raw_width; j++) data[j] = inp[off++];
            for (dp = 0, col = 0; col < raw_width - 30; dp += 16) {
              max = 2047 & (val = bin.readUint(data, dp));
              min = 2047 & val >>> 11;
              imax = 15 & val >>> 22;
              imin = 15 & val >>> 26;
              for (sh = 0; sh < 4 && 128 << sh <= max - min; sh++) ;
              for (bit = 30, i = 0; i < 16; i++)
                if (i == imax) pix[i] = max;
                else if (i == imin) pix[i] = min;
                else {
                  pix[i] = ((bin.readUshort(data, dp + (bit >> 3)) >>> (bit & 7) & 127) << sh) + min;
                  if (pix[i] > 2047) pix[i] = 2047;
                  bit += 7;
                }
              for (i = 0; i < 16; i++, col += 2) {
                var clr = pix[i] << 1;
                UTIF2.decode._putsF(tgt, (row * raw_width + col) * tiff_bps, clr << 16 - tiff_bps);
              }
              col -= col & 1 ? 1 : 31;
            }
          }
        };
        UTIF2.decode._decodeNikon = function(img, imgs, data, off, src_length, tgt, toff) {
          var nikon_tree = [
            [
              0,
              0,
              1,
              5,
              1,
              1,
              1,
              1,
              1,
              1,
              2,
              0,
              0,
              0,
              0,
              0,
              0,
              /* 12-bit lossy */
              5,
              4,
              3,
              6,
              2,
              7,
              1,
              0,
              8,
              9,
              11,
              10,
              12
            ],
            [
              0,
              0,
              1,
              5,
              1,
              1,
              1,
              1,
              1,
              1,
              2,
              0,
              0,
              0,
              0,
              0,
              0,
              /* 12-bit lossy after split */
              57,
              90,
              56,
              39,
              22,
              5,
              4,
              3,
              2,
              1,
              0,
              11,
              12,
              12
            ],
            [
              0,
              0,
              1,
              4,
              2,
              3,
              1,
              2,
              0,
              0,
              0,
              0,
              0,
              0,
              0,
              0,
              0,
              /* 12-bit lossless */
              5,
              4,
              6,
              3,
              7,
              2,
              8,
              1,
              9,
              0,
              10,
              11,
              12
            ],
            [
              0,
              0,
              1,
              4,
              3,
              1,
              1,
              1,
              1,
              1,
              2,
              0,
              0,
              0,
              0,
              0,
              0,
              /* 14-bit lossy */
              5,
              6,
              4,
              7,
              8,
              3,
              9,
              2,
              1,
              0,
              10,
              11,
              12,
              13,
              14
            ],
            [
              0,
              0,
              1,
              5,
              1,
              1,
              1,
              1,
              1,
              1,
              1,
              2,
              0,
              0,
              0,
              0,
              0,
              /* 14-bit lossy after split */
              8,
              92,
              75,
              58,
              41,
              7,
              6,
              5,
              4,
              3,
              2,
              1,
              0,
              13,
              14
            ],
            [
              0,
              0,
              1,
              4,
              2,
              2,
              3,
              1,
              2,
              0,
              0,
              0,
              0,
              0,
              0,
              0,
              0,
              /* 14-bit lossless */
              7,
              6,
              8,
              5,
              9,
              4,
              10,
              3,
              11,
              12,
              2,
              0,
              1,
              13,
              14
            ]
          ];
          var raw_width = img["t256"][0], height = img["t257"][0], tiff_bps = img["t258"][0];
          var tree = 0, split = 0;
          var make_decoder = UTIF2.decode._make_decoder;
          var getbithuff = UTIF2.decode._getbithuff;
          var mn = imgs[0].exifIFD.makerNote, md = mn["t150"] ? mn["t150"] : mn["t140"], mdo = 0;
          var ver0 = md[mdo++], ver1 = md[mdo++];
          if (ver0 == 73 || ver1 == 88) mdo += 2110;
          if (ver0 == 70) tree = 2;
          if (tiff_bps == 14) tree += 3;
          var vpred = [[0, 0], [0, 0]], bin = img.isLE ? UTIF2._binLE : UTIF2._binBE;
          for (var i = 0; i < 2; i++) for (var j = 0; j < 2; j++) {
            vpred[i][j] = bin.readShort(md, mdo);
            mdo += 2;
          }
          var max = 1 << tiff_bps & 32767, step = 0;
          var csize = bin.readShort(md, mdo);
          mdo += 2;
          if (csize > 1) step = Math.floor(max / (csize - 1));
          if (ver0 == 68 && ver1 == 32 && step > 0) split = bin.readShort(md, 562);
          var i;
          var row, col;
          var len, shl, diff;
          var min_v = 0;
          var hpred = [0, 0];
          var huff = make_decoder(nikon_tree[tree]);
          var prm = [off, 0, 0, 0];
          for (min_v = row = 0; row < height; row++) {
            if (split && row == split) {
              huff = make_decoder(nikon_tree[tree + 1]);
            }
            for (col = 0; col < raw_width; col++) {
              i = getbithuff(data, prm, huff[0], huff);
              len = i & 15;
              shl = i >>> 4;
              diff = (getbithuff(data, prm, len - shl, 0) << 1) + 1 << shl >>> 1;
              if ((diff & 1 << len - 1) == 0)
                diff -= (1 << len) - (shl == 0 ? 1 : 0);
              if (col < 2) hpred[col] = vpred[row & 1][col] += diff;
              else hpred[col & 1] += diff;
              var clr = Math.min(Math.max(hpred[col & 1], 0), (1 << tiff_bps) - 1);
              var bti = (row * raw_width + col) * tiff_bps;
              UTIF2.decode._putsF(tgt, bti, clr << 16 - tiff_bps);
            }
          }
        };
        UTIF2.decode._putsF = function(dt, pos, val) {
          val = val << 8 - (pos & 7);
          var o = pos >>> 3;
          dt[o] |= val >>> 16;
          dt[o + 1] |= val >>> 8;
          dt[o + 2] |= val;
        };
        UTIF2.decode._getbithuff = function(data, prm, nbits, huff) {
          var zero_after_ff = 0;
          var get_byte = UTIF2.decode._get_byte;
          var c;
          var off = prm[0], bitbuf = prm[1], vbits = prm[2], reset = prm[3];
          if (nbits == 0 || vbits < 0) return 0;
          while (!reset && vbits < nbits && (c = data[off++]) != -1 && !(reset = zero_after_ff && c == 255 && data[off++])) {
            bitbuf = (bitbuf << 8) + c;
            vbits += 8;
          }
          c = bitbuf << 32 - vbits >>> 32 - nbits;
          if (huff) {
            vbits -= huff[c + 1] >>> 8;
            c = huff[c + 1] & 255;
          } else
            vbits -= nbits;
          if (vbits < 0) throw "e";
          prm[0] = off;
          prm[1] = bitbuf;
          prm[2] = vbits;
          prm[3] = reset;
          return c;
        };
        UTIF2.decode._make_decoder = function(source) {
          var max, len, h, i, j;
          var huff = [];
          for (max = 16; max != 0 && !source[max]; max--) ;
          var si = 17;
          huff[0] = max;
          for (h = len = 1; len <= max; len++)
            for (i = 0; i < source[len]; i++, ++si)
              for (j = 0; j < 1 << max - len; j++)
                if (h <= 1 << max)
                  huff[h++] = len << 8 | source[si];
          return huff;
        };
        UTIF2.decode._decodeNewJPEG = function(img, data, off, len, tgt, toff) {
          var tables = img["t347"], tlen = tables ? tables.length : 0, buff = new Uint8Array(tlen + len);
          if (tables) {
            var SOI = 216, EOI2 = 217, boff = 0;
            for (var i = 0; i < tlen - 1; i++) {
              if (tables[i] == 255 && tables[i + 1] == EOI2) break;
              buff[boff++] = tables[i];
            }
            var byte1 = data[off], byte2 = data[off + 1];
            if (byte1 != 255 || byte2 != SOI) {
              buff[boff++] = byte1;
              buff[boff++] = byte2;
            }
            for (var i = 2; i < len; i++) buff[boff++] = data[off + i];
          } else for (var i = 0; i < len; i++) buff[i] = data[off + i];
          if (img["t262"][0] == 32803 || img["t262"][0] == 34892) {
            var bps = img["t258"][0];
            var out = UTIF2.LosslessJpegDecode(buff), olen = out.length;
            if (false) {
            } else if (bps == 16) {
              if (img.isLE) for (var i = 0; i < olen; i++) {
                tgt[toff + (i << 1)] = out[i] & 255;
                tgt[toff + (i << 1) + 1] = out[i] >>> 8;
              }
              else for (var i = 0; i < olen; i++) {
                tgt[toff + (i << 1)] = out[i] >>> 8;
                tgt[toff + (i << 1) + 1] = out[i] & 255;
              }
            } else if (bps == 14 || bps == 12) {
              var rst = 16 - bps;
              for (var i = 0; i < olen; i++) UTIF2.decode._putsF(tgt, i * bps, out[i] << rst);
            } else throw new Error("unsupported bit depth " + bps);
          } else {
            var parser = new UTIF2.JpegDecoder();
            parser.parse(buff);
            var decoded = parser.getData(parser.width, parser.height);
            for (var i = 0; i < decoded.length; i++) tgt[toff + i] = decoded[i];
          }
          if (img["t262"][0] == 6) img["t262"][0] = 2;
        };
        UTIF2.decode._decodeOldJPEGInit = function(img, data, off, len) {
          var SOI = 216, EOI2 = 217, DQT = 219, DHT = 196, DRI = 221, SOF0 = 192, SOS2 = 218;
          var joff = 0, soff = 0, tables, sosMarker2, isTiled = false, i, j, k;
          var jpgIchgFmt = img["t513"], jifoff = jpgIchgFmt ? jpgIchgFmt[0] : 0;
          var jpgIchgFmtLen = img["t514"], jiflen = jpgIchgFmtLen ? jpgIchgFmtLen[0] : 0;
          var soffTag = img["t324"] || img["t273"] || jpgIchgFmt;
          var ycbcrss = img["t530"], ssx = 0, ssy = 0;
          var spp = img["t277"] ? img["t277"][0] : 1;
          var jpgresint = img["t515"];
          if (soffTag) {
            soff = soffTag[0];
            isTiled = soffTag.length > 1;
          }
          if (!isTiled) {
            if (data[off] == 255 && data[off + 1] == SOI) return { jpegOffset: off };
            if (jpgIchgFmt != null) {
              if (data[off + jifoff] == 255 && data[off + jifoff + 1] == SOI) joff = off + jifoff;
              else log("JPEGInterchangeFormat does not point to SOI");
              if (jpgIchgFmtLen == null) log("JPEGInterchangeFormatLength field is missing");
              else if (jifoff >= soff || jifoff + jiflen <= soff) log("JPEGInterchangeFormatLength field value is invalid");
              if (joff != null) return { jpegOffset: joff };
            }
          }
          if (ycbcrss != null) {
            ssx = ycbcrss[0];
            ssy = ycbcrss[1];
          }
          if (jpgIchgFmt != null) {
            if (jpgIchgFmtLen != null)
              if (jiflen >= 2 && jifoff + jiflen <= soff) {
                if (data[off + jifoff + jiflen - 2] == 255 && data[off + jifoff + jiflen - 1] == SOI) tables = new Uint8Array(jiflen - 2);
                else tables = new Uint8Array(jiflen);
                for (i = 0; i < tables.length; i++) tables[i] = data[off + jifoff + i];
                log("Incorrect JPEG interchange format: using JPEGInterchangeFormat offset to derive tables");
              } else log("JPEGInterchangeFormat+JPEGInterchangeFormatLength > offset to first strip or tile");
          }
          if (tables == null) {
            var ooff = 0, out = [];
            out[ooff++] = 255;
            out[ooff++] = SOI;
            var qtables = img["t519"];
            if (qtables == null) throw new Error("JPEGQTables tag is missing");
            for (i = 0; i < qtables.length; i++) {
              out[ooff++] = 255;
              out[ooff++] = DQT;
              out[ooff++] = 0;
              out[ooff++] = 67;
              out[ooff++] = i;
              for (j = 0; j < 64; j++) out[ooff++] = data[off + qtables[i] + j];
            }
            for (k = 0; k < 2; k++) {
              var htables = img[k == 0 ? "t520" : "t521"];
              if (htables == null) throw new Error((k == 0 ? "JPEGDCTables" : "JPEGACTables") + " tag is missing");
              for (i = 0; i < htables.length; i++) {
                out[ooff++] = 255;
                out[ooff++] = DHT;
                var nc = 19;
                for (j = 0; j < 16; j++) nc += data[off + htables[i] + j];
                out[ooff++] = nc >>> 8;
                out[ooff++] = nc & 255;
                out[ooff++] = i | k << 4;
                for (j = 0; j < 16; j++) out[ooff++] = data[off + htables[i] + j];
                for (j = 0; j < nc; j++) out[ooff++] = data[off + htables[i] + 16 + j];
              }
            }
            out[ooff++] = 255;
            out[ooff++] = SOF0;
            out[ooff++] = 0;
            out[ooff++] = 8 + 3 * spp;
            out[ooff++] = 8;
            out[ooff++] = img.height >>> 8 & 255;
            out[ooff++] = img.height & 255;
            out[ooff++] = img.width >>> 8 & 255;
            out[ooff++] = img.width & 255;
            out[ooff++] = spp;
            if (spp == 1) {
              out[ooff++] = 1;
              out[ooff++] = 17;
              out[ooff++] = 0;
            } else for (i = 0; i < 3; i++) {
              out[ooff++] = i + 1;
              out[ooff++] = i != 0 ? 17 : (ssx & 15) << 4 | ssy & 15;
              out[ooff++] = i;
            }
            if (jpgresint != null && jpgresint[0] != 0) {
              out[ooff++] = 255;
              out[ooff++] = DRI;
              out[ooff++] = 0;
              out[ooff++] = 4;
              out[ooff++] = jpgresint[0] >>> 8 & 255;
              out[ooff++] = jpgresint[0] & 255;
            }
            tables = new Uint8Array(out);
          }
          var sofpos = -1;
          i = 0;
          while (i < tables.length - 1) {
            if (tables[i] == 255 && tables[i + 1] == SOF0) {
              sofpos = i;
              break;
            }
            i++;
          }
          if (sofpos == -1) {
            var tmptab = new Uint8Array(tables.length + 10 + 3 * spp);
            tmptab.set(tables);
            var tmpoff = tables.length;
            sofpos = tables.length;
            tables = tmptab;
            tables[tmpoff++] = 255;
            tables[tmpoff++] = SOF0;
            tables[tmpoff++] = 0;
            tables[tmpoff++] = 8 + 3 * spp;
            tables[tmpoff++] = 8;
            tables[tmpoff++] = img.height >>> 8 & 255;
            tables[tmpoff++] = img.height & 255;
            tables[tmpoff++] = img.width >>> 8 & 255;
            tables[tmpoff++] = img.width & 255;
            tables[tmpoff++] = spp;
            if (spp == 1) {
              tables[tmpoff++] = 1;
              tables[tmpoff++] = 17;
              tables[tmpoff++] = 0;
            } else for (i = 0; i < 3; i++) {
              tables[tmpoff++] = i + 1;
              tables[tmpoff++] = i != 0 ? 17 : (ssx & 15) << 4 | ssy & 15;
              tables[tmpoff++] = i;
            }
          }
          if (data[soff] == 255 && data[soff + 1] == SOS2) {
            var soslen = data[soff + 2] << 8 | data[soff + 3];
            sosMarker2 = new Uint8Array(soslen + 2);
            sosMarker2[0] = data[soff];
            sosMarker2[1] = data[soff + 1];
            sosMarker2[2] = data[soff + 2];
            sosMarker2[3] = data[soff + 3];
            for (i = 0; i < soslen - 2; i++) sosMarker2[i + 4] = data[soff + i + 4];
          } else {
            sosMarker2 = new Uint8Array(2 + 6 + 2 * spp);
            var sosoff = 0;
            sosMarker2[sosoff++] = 255;
            sosMarker2[sosoff++] = SOS2;
            sosMarker2[sosoff++] = 0;
            sosMarker2[sosoff++] = 6 + 2 * spp;
            sosMarker2[sosoff++] = spp;
            if (spp == 1) {
              sosMarker2[sosoff++] = 1;
              sosMarker2[sosoff++] = 0;
            } else for (i = 0; i < 3; i++) {
              sosMarker2[sosoff++] = i + 1;
              sosMarker2[sosoff++] = i << 4 | i;
            }
            sosMarker2[sosoff++] = 0;
            sosMarker2[sosoff++] = 63;
            sosMarker2[sosoff++] = 0;
          }
          return { jpegOffset: off, tables, sosMarker: sosMarker2, sofPosition: sofpos };
        };
        UTIF2.decode._decodeOldJPEG = function(img, data, off, len, tgt, toff) {
          var i, dlen, tlen, buff, buffoff;
          var jpegData = UTIF2.decode._decodeOldJPEGInit(img, data, off, len);
          if (jpegData.jpegOffset != null) {
            dlen = off + len - jpegData.jpegOffset;
            buff = new Uint8Array(dlen);
            for (i = 0; i < dlen; i++) buff[i] = data[jpegData.jpegOffset + i];
          } else {
            tlen = jpegData.tables.length;
            buff = new Uint8Array(tlen + jpegData.sosMarker.length + len + 2);
            buff.set(jpegData.tables);
            buffoff = tlen;
            buff[jpegData.sofPosition + 5] = img.height >>> 8 & 255;
            buff[jpegData.sofPosition + 6] = img.height & 255;
            buff[jpegData.sofPosition + 7] = img.width >>> 8 & 255;
            buff[jpegData.sofPosition + 8] = img.width & 255;
            if (data[off] != 255 || data[off + 1] != SOS) {
              buff.set(jpegData.sosMarker, buffoff);
              buffoff += sosMarker.length;
            }
            for (i = 0; i < len; i++) buff[buffoff++] = data[off + i];
            buff[buffoff++] = 255;
            buff[buffoff++] = EOI;
          }
          var parser = new UTIF2.JpegDecoder();
          parser.parse(buff);
          var decoded = parser.getData(parser.width, parser.height);
          for (var i = 0; i < decoded.length; i++) tgt[toff + i] = decoded[i];
          if (img["t262"] && img["t262"][0] == 6) img["t262"][0] = 2;
        };
        UTIF2.decode._decodePackBits = function(data, off, len, tgt, toff) {
          var sa = new Int8Array(data.buffer), ta = new Int8Array(tgt.buffer), lim = off + len;
          while (off < lim) {
            var n = sa[off];
            off++;
            if (n >= 0 && n < 128) for (var i = 0; i < n + 1; i++) {
              ta[toff] = sa[off];
              toff++;
              off++;
            }
            if (n >= -127 && n < 0) {
              for (var i = 0; i < -n + 1; i++) {
                ta[toff] = sa[off];
                toff++;
              }
              off++;
            }
          }
        };
        UTIF2.decode._decodeThunder = function(data, off, len, tgt, toff) {
          var d2 = [0, 1, 0, -1], d3 = [0, 1, 2, 3, 0, -3, -2, -1];
          var lim = off + len, qoff = toff * 2, px = 0;
          while (off < lim) {
            var b = data[off], msk = b >>> 6, n = b & 63;
            off++;
            if (msk == 3) {
              px = n & 15;
              tgt[qoff >>> 1] |= px << 4 * (1 - qoff & 1);
              qoff++;
            }
            if (msk == 0) for (var i = 0; i < n; i++) {
              tgt[qoff >>> 1] |= px << 4 * (1 - qoff & 1);
              qoff++;
            }
            if (msk == 2) for (var i = 0; i < 2; i++) {
              var d = n >>> 3 * (1 - i) & 7;
              if (d != 4) {
                px += d3[d];
                tgt[qoff >>> 1] |= px << 4 * (1 - qoff & 1);
                qoff++;
              }
            }
            if (msk == 1) for (var i = 0; i < 3; i++) {
              var d = n >>> 2 * (2 - i) & 3;
              if (d != 2) {
                px += d2[d];
                tgt[qoff >>> 1] |= px << 4 * (1 - qoff & 1);
                qoff++;
              }
            }
          }
        };
        UTIF2.decode._dmap = { "1": 0, "011": 1, "000011": 2, "0000011": 3, "010": -1, "000010": -2, "0000010": -3 };
        UTIF2.decode._lens = (function() {
          var addKeys = function(lens, arr, i0, inc) {
            for (var i = 0; i < arr.length; i++) lens[arr[i]] = i0 + i * inc;
          };
          var termW = "00110101,000111,0111,1000,1011,1100,1110,1111,10011,10100,00111,01000,001000,000011,110100,110101,101010,101011,0100111,0001100,0001000,0010111,0000011,0000100,0101000,0101011,0010011,0100100,0011000,00000010,00000011,00011010,00011011,00010010,00010011,00010100,00010101,00010110,00010111,00101000,00101001,00101010,00101011,00101100,00101101,00000100,00000101,00001010,00001011,01010010,01010011,01010100,01010101,00100100,00100101,01011000,01011001,01011010,01011011,01001010,01001011,00110010,00110011,00110100";
          var termB = "0000110111,010,11,10,011,0011,0010,00011,000101,000100,0000100,0000101,0000111,00000100,00000111,000011000,0000010111,0000011000,0000001000,00001100111,00001101000,00001101100,00000110111,00000101000,00000010111,00000011000,000011001010,000011001011,000011001100,000011001101,000001101000,000001101001,000001101010,000001101011,000011010010,000011010011,000011010100,000011010101,000011010110,000011010111,000001101100,000001101101,000011011010,000011011011,000001010100,000001010101,000001010110,000001010111,000001100100,000001100101,000001010010,000001010011,000000100100,000000110111,000000111000,000000100111,000000101000,000001011000,000001011001,000000101011,000000101100,000001011010,000001100110,000001100111";
          var makeW = "11011,10010,010111,0110111,00110110,00110111,01100100,01100101,01101000,01100111,011001100,011001101,011010010,011010011,011010100,011010101,011010110,011010111,011011000,011011001,011011010,011011011,010011000,010011001,010011010,011000,010011011";
          var makeB = "0000001111,000011001000,000011001001,000001011011,000000110011,000000110100,000000110101,0000001101100,0000001101101,0000001001010,0000001001011,0000001001100,0000001001101,0000001110010,0000001110011,0000001110100,0000001110101,0000001110110,0000001110111,0000001010010,0000001010011,0000001010100,0000001010101,0000001011010,0000001011011,0000001100100,0000001100101";
          var makeA = "00000001000,00000001100,00000001101,000000010010,000000010011,000000010100,000000010101,000000010110,000000010111,000000011100,000000011101,000000011110,000000011111";
          termW = termW.split(",");
          termB = termB.split(",");
          makeW = makeW.split(",");
          makeB = makeB.split(",");
          makeA = makeA.split(",");
          var lensW = {}, lensB = {};
          addKeys(lensW, termW, 0, 1);
          addKeys(lensW, makeW, 64, 64);
          addKeys(lensW, makeA, 1792, 64);
          addKeys(lensB, termB, 0, 1);
          addKeys(lensB, makeB, 64, 64);
          addKeys(lensB, makeA, 1792, 64);
          return [lensW, lensB];
        })();
        UTIF2.decode._decodeG4 = function(data, off, slen, tgt, toff, w, fo) {
          var U = UTIF2.decode, boff = off << 3, len = 0, wrd = "";
          var line = [], pline = [];
          for (var i = 0; i < w; i++) pline.push(0);
          pline = U._makeDiff(pline);
          var a0 = 0, a1 = 0, a2 = 0, b1 = 0, b2 = 0, clr = 0;
          var y = 0, mode = "", toRead = 0;
          var bipl = Math.ceil(w / 8) * 8;
          while (boff >>> 3 < off + slen) {
            b1 = U._findDiff(pline, a0 + (a0 == 0 ? 0 : 1), 1 - clr), b2 = U._findDiff(pline, b1, clr);
            var bit = 0;
            if (fo == 1) bit = data[boff >>> 3] >>> 7 - (boff & 7) & 1;
            if (fo == 2) bit = data[boff >>> 3] >>> (boff & 7) & 1;
            boff++;
            wrd += bit;
            if (mode == "H") {
              if (U._lens[clr][wrd] != null) {
                var dl = U._lens[clr][wrd];
                wrd = "";
                len += dl;
                if (dl < 64) {
                  U._addNtimes(line, len, clr);
                  a0 += len;
                  clr = 1 - clr;
                  len = 0;
                  toRead--;
                  if (toRead == 0) mode = "";
                }
              }
            } else {
              if (wrd == "0001") {
                wrd = "";
                U._addNtimes(line, b2 - a0, clr);
                a0 = b2;
              }
              if (wrd == "001") {
                wrd = "";
                mode = "H";
                toRead = 2;
              }
              if (U._dmap[wrd] != null) {
                a1 = b1 + U._dmap[wrd];
                U._addNtimes(line, a1 - a0, clr);
                a0 = a1;
                wrd = "";
                clr = 1 - clr;
              }
            }
            if (line.length == w && mode == "") {
              U._writeBits(line, tgt, toff * 8 + y * bipl);
              clr = 0;
              y++;
              a0 = 0;
              pline = U._makeDiff(line);
              line = [];
            }
          }
        };
        UTIF2.decode._findDiff = function(line, x, clr) {
          for (var i = 0; i < line.length; i += 2) if (line[i] >= x && line[i + 1] == clr) return line[i];
        };
        UTIF2.decode._makeDiff = function(line) {
          var out = [];
          if (line[0] == 1) out.push(0, 1);
          for (var i = 1; i < line.length; i++) if (line[i - 1] != line[i]) out.push(i, line[i]);
          out.push(line.length, 0, line.length, 1);
          return out;
        };
        UTIF2.decode._decodeG3 = function(data, off, slen, tgt, toff, w, fo) {
          var U = UTIF2.decode, boff = off << 3, len = 0, wrd = "";
          var line = [], pline = [];
          for (var i = 0; i < w; i++) line.push(0);
          var a0 = 0, a1 = 0, a2 = 0, b1 = 0, b2 = 0, clr = 0;
          var y = -1, mode = "", toRead = 0, is1D = false;
          var bipl = Math.ceil(w / 8) * 8;
          while (boff >>> 3 < off + slen) {
            b1 = U._findDiff(pline, a0 + (a0 == 0 ? 0 : 1), 1 - clr), b2 = U._findDiff(pline, b1, clr);
            var bit = 0;
            if (fo == 1) bit = data[boff >>> 3] >>> 7 - (boff & 7) & 1;
            if (fo == 2) bit = data[boff >>> 3] >>> (boff & 7) & 1;
            boff++;
            wrd += bit;
            if (is1D) {
              if (U._lens[clr][wrd] != null) {
                var dl = U._lens[clr][wrd];
                wrd = "";
                len += dl;
                if (dl < 64) {
                  U._addNtimes(line, len, clr);
                  clr = 1 - clr;
                  len = 0;
                }
              }
            } else {
              if (mode == "H") {
                if (U._lens[clr][wrd] != null) {
                  var dl = U._lens[clr][wrd];
                  wrd = "";
                  len += dl;
                  if (dl < 64) {
                    U._addNtimes(line, len, clr);
                    a0 += len;
                    clr = 1 - clr;
                    len = 0;
                    toRead--;
                    if (toRead == 0) mode = "";
                  }
                }
              } else {
                if (wrd == "0001") {
                  wrd = "";
                  U._addNtimes(line, b2 - a0, clr);
                  a0 = b2;
                }
                if (wrd == "001") {
                  wrd = "";
                  mode = "H";
                  toRead = 2;
                }
                if (U._dmap[wrd] != null) {
                  a1 = b1 + U._dmap[wrd];
                  U._addNtimes(line, a1 - a0, clr);
                  a0 = a1;
                  wrd = "";
                  clr = 1 - clr;
                }
              }
            }
            if (wrd.endsWith("000000000001")) {
              if (y >= 0) U._writeBits(line, tgt, toff * 8 + y * bipl);
              if (fo == 1) is1D = (data[boff >>> 3] >>> 7 - (boff & 7) & 1) == 1;
              if (fo == 2) is1D = (data[boff >>> 3] >>> (boff & 7) & 1) == 1;
              boff++;
              if (U._decodeG3.allow2D == null) U._decodeG3.allow2D = is1D;
              if (!U._decodeG3.allow2D) {
                is1D = true;
                boff--;
              }
              wrd = "";
              clr = 0;
              y++;
              a0 = 0;
              pline = U._makeDiff(line);
              line = [];
            }
          }
          if (line.length == w) U._writeBits(line, tgt, toff * 8 + y * bipl);
        };
        UTIF2.decode._addNtimes = function(arr, n, val) {
          for (var i = 0; i < n; i++) arr.push(val);
        };
        UTIF2.decode._writeBits = function(bits, tgt, boff) {
          for (var i = 0; i < bits.length; i++) tgt[boff + i >>> 3] |= bits[i] << 7 - (boff + i & 7);
        };
        UTIF2.decode._decodeLZW = function(data, off, tgt, toff) {
          if (UTIF2.decode._lzwTab == null) {
            var tb = new Uint32Array(65535), tn = new Uint16Array(65535), chr = new Uint8Array(2e6);
            for (var i = 0; i < 256; i++) {
              chr[i << 2] = i;
              tb[i] = i << 2;
              tn[i] = 1;
            }
            UTIF2.decode._lzwTab = [tb, tn, chr];
          }
          var copy = UTIF2.decode._copyData;
          var tab = UTIF2.decode._lzwTab[0], tln = UTIF2.decode._lzwTab[1], chr = UTIF2.decode._lzwTab[2], totl = 258, chrl = 258 << 2;
          var bits = 9, boff = off << 3;
          var ClearCode = 256, EoiCode = 257;
          var v = 0, Code = 0, OldCode = 0;
          while (true) {
            v = data[boff >>> 3] << 16 | data[boff + 8 >>> 3] << 8 | data[boff + 16 >>> 3];
            Code = v >> 24 - (boff & 7) - bits & (1 << bits) - 1;
            boff += bits;
            if (Code == EoiCode) break;
            if (Code == ClearCode) {
              bits = 9;
              totl = 258;
              chrl = 258 << 2;
              v = data[boff >>> 3] << 16 | data[boff + 8 >>> 3] << 8 | data[boff + 16 >>> 3];
              Code = v >> 24 - (boff & 7) - bits & (1 << bits) - 1;
              boff += bits;
              if (Code == EoiCode) break;
              tgt[toff] = Code;
              toff++;
            } else if (Code < totl) {
              var cd = tab[Code], cl = tln[Code];
              copy(chr, cd, tgt, toff, cl);
              toff += cl;
              if (OldCode >= totl) {
                tab[totl] = chrl;
                chr[tab[totl]] = cd[0];
                tln[totl] = 1;
                chrl = chrl + 1 + 3 & ~3;
                totl++;
              } else {
                tab[totl] = chrl;
                var nit = tab[OldCode], nil = tln[OldCode];
                copy(chr, nit, chr, chrl, nil);
                chr[chrl + nil] = chr[cd];
                nil++;
                tln[totl] = nil;
                totl++;
                chrl = chrl + nil + 3 & ~3;
              }
              if (totl + 1 == 1 << bits) bits++;
            } else {
              if (OldCode >= totl) {
                tab[totl] = chrl;
                tln[totl] = 0;
                totl++;
              } else {
                tab[totl] = chrl;
                var nit = tab[OldCode], nil = tln[OldCode];
                copy(chr, nit, chr, chrl, nil);
                chr[chrl + nil] = chr[chrl];
                nil++;
                tln[totl] = nil;
                totl++;
                copy(chr, chrl, tgt, toff, nil);
                toff += nil;
                chrl = chrl + nil + 3 & ~3;
              }
              if (totl + 1 == 1 << bits) bits++;
            }
            OldCode = Code;
          }
        };
        UTIF2.decode._copyData = function(s, so, t, to, l) {
          for (var i = 0; i < l; i += 4) {
            t[to + i] = s[so + i];
            t[to + i + 1] = s[so + i + 1];
            t[to + i + 2] = s[so + i + 2];
            t[to + i + 3] = s[so + i + 3];
          }
        };
        UTIF2.tags = {};
        UTIF2.ttypes = { 256: 3, 257: 3, 258: 3, 259: 3, 262: 3, 273: 4, 274: 3, 277: 3, 278: 4, 279: 4, 282: 5, 283: 5, 284: 3, 286: 5, 287: 5, 296: 3, 305: 2, 306: 2, 338: 3, 513: 4, 514: 4, 34665: 4 };
        UTIF2._readIFD = function(bin, data, offset, ifds, depth, debug) {
          var cnt = bin.readUshort(data, offset);
          offset += 2;
          var ifd = {};
          ifds.push(ifd);
          if (debug) log("   ".repeat(depth), ifds.length - 1, ">>>----------------");
          for (var i = 0; i < cnt; i++) {
            var tag = bin.readUshort(data, offset);
            offset += 2;
            var type = bin.readUshort(data, offset);
            offset += 2;
            var num = bin.readUint(data, offset);
            offset += 4;
            var voff = bin.readUint(data, offset);
            offset += 4;
            var arr = [];
            if (type == 1 || type == 7) {
              arr = new Uint8Array(data.buffer, num < 5 ? offset - 4 : voff, num);
            }
            if (type == 2) {
              var o0 = num < 5 ? offset - 4 : voff, c = data[o0];
              if (c < 128) arr.push(bin.readASCII(data, o0, num - 1));
              else arr = new Uint8Array(data.buffer, o0, num - 1);
            }
            if (type == 3) {
              for (var j = 0; j < num; j++) arr.push(bin.readUshort(data, (num < 3 ? offset - 4 : voff) + 2 * j));
            }
            if (type == 4) {
              for (var j = 0; j < num; j++) arr.push(bin.readUint(data, (num < 2 ? offset - 4 : voff) + 4 * j));
            }
            if (type == 5) {
              for (var j = 0; j < num; j++) arr.push(bin.readUint(data, voff + j * 8) / bin.readUint(data, voff + j * 8 + 4));
            }
            if (type == 8) {
              for (var j = 0; j < num; j++) arr.push(bin.readShort(data, (num < 3 ? offset - 4 : voff) + 2 * j));
            }
            if (type == 9) {
              for (var j = 0; j < num; j++) arr.push(bin.readInt(data, (num < 2 ? offset - 4 : voff) + 4 * j));
            }
            if (type == 10) {
              for (var j = 0; j < num; j++) arr.push(bin.readInt(data, voff + j * 8) / bin.readInt(data, voff + j * 8 + 4));
            }
            if (type == 11) {
              for (var j = 0; j < num; j++) arr.push(bin.readFloat(data, voff + j * 4));
            }
            if (type == 12) {
              for (var j = 0; j < num; j++) arr.push(bin.readDouble(data, voff + j * 8));
            }
            ifd["t" + tag] = arr;
            if (num != 0 && arr.length == 0) {
              log("unknown TIFF tag type: ", type, "num:", num);
            }
            if (debug) log("   ".repeat(depth), tag, type, UTIF2.tags[tag], arr);
            if (tag == 330 && ifd["t272"] && ifd["t272"][0] == "DSLR-A100") {
            } else if (tag == 330 || tag == 34665 || tag == 50740 && bin.readUshort(data, bin.readUint(arr, 0)) < 300) {
              var oarr = tag == 50740 ? [bin.readUint(arr, 0)] : arr;
              var subfd = [];
              for (var j = 0; j < oarr.length; j++) UTIF2._readIFD(bin, data, oarr[j], subfd, depth + 1, debug);
              if (tag == 330) ifd.subIFD = subfd;
              if (tag == 34665) ifd.exifIFD = subfd[0];
              if (tag == 50740) ifd.dngPrvt = subfd[0];
            }
            if (tag == 37500) {
              var mn = arr;
              if (bin.readASCII(mn, 0, 5) == "Nikon") ifd.makerNote = UTIF2["decode"](mn.slice(10).buffer)[0];
              else if (bin.readUshort(data, voff) < 300) {
                var subsub = [];
                UTIF2._readIFD(bin, data, voff, subsub, depth + 1, debug);
                ifd.makerNote = subsub[0];
              }
            }
          }
          if (debug) log("   ".repeat(depth), "<<<---------------");
          return offset;
        };
        UTIF2._writeIFD = function(bin, data, offset, ifd) {
          var keys = Object.keys(ifd);
          bin.writeUshort(data, offset, keys.length);
          offset += 2;
          var eoff = offset + keys.length * 12 + 4;
          for (var ki = 0; ki < keys.length; ki++) {
            var key = keys[ki];
            var tag = parseInt(key.slice(1)), type = UTIF2.ttypes[tag];
            if (type == null) throw new Error("unknown type of tag: " + tag);
            var val = ifd[key];
            if (type == 2) val = val[0] + "\0";
            var num = val.length;
            bin.writeUshort(data, offset, tag);
            offset += 2;
            bin.writeUshort(data, offset, type);
            offset += 2;
            bin.writeUint(data, offset, num);
            offset += 4;
            var dlen = [-1, 1, 1, 2, 4, 8, 0, 0, 0, 0, 0, 0, 8][type] * num;
            var toff = offset;
            if (dlen > 4) {
              bin.writeUint(data, offset, eoff);
              toff = eoff;
            }
            if (type == 2) {
              bin.writeASCII(data, toff, val);
            }
            if (type == 3) {
              for (var i = 0; i < num; i++) bin.writeUshort(data, toff + 2 * i, val[i]);
            }
            if (type == 4) {
              for (var i = 0; i < num; i++) bin.writeUint(data, toff + 4 * i, val[i]);
            }
            if (type == 5) {
              for (var i = 0; i < num; i++) {
                bin.writeUint(data, toff + 8 * i, Math.round(val[i] * 1e4));
                bin.writeUint(data, toff + 8 * i + 4, 1e4);
              }
            }
            if (type == 12) {
              for (var i = 0; i < num; i++) bin.writeDouble(data, toff + 8 * i, val[i]);
            }
            if (dlen > 4) {
              dlen += dlen & 1;
              eoff += dlen;
            }
            offset += 4;
          }
          return [offset, eoff];
        };
        UTIF2.toRGBA8 = function(out) {
          var w = out.width, h = out.height, area = w * h, qarea = area * 4, data = out.data;
          var img = new Uint8Array(area * 4);
          var intp = out["t262"] ? out["t262"][0] : 2, bps = out["t258"] ? Math.min(32, out["t258"][0]) : 1;
          if (false) {
          } else if (intp == 0) {
            var bpl = Math.ceil(bps * w / 8);
            for (var y = 0; y < h; y++) {
              var off = y * bpl, io = y * w;
              if (bps == 1) for (var i = 0; i < w; i++) {
                var qi = io + i << 2, px = data[off + (i >> 3)] >> 7 - (i & 7) & 1;
                img[qi] = img[qi + 1] = img[qi + 2] = (1 - px) * 255;
                img[qi + 3] = 255;
              }
              if (bps == 4) for (var i = 0; i < w; i++) {
                var qi = io + i << 2, px = data[off + (i >> 1)] >> 4 - 4 * (i & 1) & 15;
                img[qi] = img[qi + 1] = img[qi + 2] = (15 - px) * 17;
                img[qi + 3] = 255;
              }
              if (bps == 8) for (var i = 0; i < w; i++) {
                var qi = io + i << 2, px = data[off + i];
                img[qi] = img[qi + 1] = img[qi + 2] = 255 - px;
                img[qi + 3] = 255;
              }
            }
          } else if (intp == 1) {
            var bpl = Math.ceil(bps * w / 8);
            for (var y = 0; y < h; y++) {
              var off = y * bpl, io = y * w;
              if (bps == 1) for (var i = 0; i < w; i++) {
                var qi = io + i << 2, px = data[off + (i >> 3)] >> 7 - (i & 7) & 1;
                img[qi] = img[qi + 1] = img[qi + 2] = px * 255;
                img[qi + 3] = 255;
              }
              if (bps == 2) for (var i = 0; i < w; i++) {
                var qi = io + i << 2, px = data[off + (i >> 2)] >> 6 - 2 * (i & 3) & 3;
                img[qi] = img[qi + 1] = img[qi + 2] = px * 85;
                img[qi + 3] = 255;
              }
              if (bps == 8) for (var i = 0; i < w; i++) {
                var qi = io + i << 2, px = data[off + i];
                img[qi] = img[qi + 1] = img[qi + 2] = px;
                img[qi + 3] = 255;
              }
              if (bps == 16) for (var i = 0; i < w; i++) {
                var qi = io + i << 2, px = data[off + (2 * i + 1)];
                img[qi] = img[qi + 1] = img[qi + 2] = Math.min(255, px);
                img[qi + 3] = 255;
              }
            }
          } else if (intp == 2) {
            var smpls = out["t258"] ? out["t258"].length : 3;
            if (bps == 8) {
              if (smpls == 4) for (var i = 0; i < qarea; i++) img[i] = data[i];
              if (smpls == 3) for (var i = 0; i < area; i++) {
                var qi = i << 2, ti = i * 3;
                img[qi] = data[ti];
                img[qi + 1] = data[ti + 1];
                img[qi + 2] = data[ti + 2];
                img[qi + 3] = 255;
              }
            } else {
              if (smpls == 4) for (var i = 0; i < area; i++) {
                var qi = i << 2, ti = i * 8 + 1;
                img[qi] = data[ti];
                img[qi + 1] = data[ti + 2];
                img[qi + 2] = data[ti + 4];
                img[qi + 3] = data[ti + 6];
              }
              if (smpls == 3) for (var i = 0; i < area; i++) {
                var qi = i << 2, ti = i * 6 + 1;
                img[qi] = data[ti];
                img[qi + 1] = data[ti + 2];
                img[qi + 2] = data[ti + 4];
                img[qi + 3] = 255;
              }
            }
          } else if (intp == 3) {
            var map = out["t320"];
            for (var i = 0; i < area; i++) {
              var qi = i << 2, mi = data[i];
              img[qi] = map[mi] >> 8;
              img[qi + 1] = map[256 + mi] >> 8;
              img[qi + 2] = map[512 + mi] >> 8;
              img[qi + 3] = 255;
            }
          } else if (intp == 5) {
            var smpls = out["t258"] ? out["t258"].length : 4;
            var gotAlpha = smpls > 4 ? 1 : 0;
            for (var i = 0; i < area; i++) {
              var qi = i << 2, si = i * smpls;
              var C = 255 - data[si], M = 255 - data[si + 1], Y = 255 - data[si + 2], K = (255 - data[si + 3]) * (1 / 255);
              img[qi] = ~~(C * K + 0.5);
              img[qi + 1] = ~~(M * K + 0.5);
              img[qi + 2] = ~~(Y * K + 0.5);
              img[qi + 3] = 255 * (1 - gotAlpha) + data[si + 4] * gotAlpha;
            }
          } else log("Unknown Photometric interpretation: " + intp);
          return img;
        };
        UTIF2.replaceIMG = function(imgs) {
          if (imgs == null) imgs = document.getElementsByTagName("img");
          var sufs = ["tif", "tiff", "dng", "cr2", "nef"];
          for (var i = 0; i < imgs.length; i++) {
            var img = imgs[i], src = img.getAttribute("src");
            if (src == null) continue;
            var suff = src.split(".").pop().toLowerCase();
            if (sufs.indexOf(suff) == -1) continue;
            var xhr = new XMLHttpRequest();
            UTIF2._xhrs.push(xhr);
            UTIF2._imgs.push(img);
            xhr.open("GET", src);
            xhr.responseType = "arraybuffer";
            xhr.onload = UTIF2._imgLoaded;
            xhr.send();
          }
        };
        UTIF2._xhrs = [];
        UTIF2._imgs = [];
        UTIF2._imgLoaded = function(e) {
          var buff = e.target.response;
          var ifds = UTIF2.decode(buff);
          var vsns = ifds, ma = 0, page = vsns[0];
          if (ifds[0].subIFD) vsns = vsns.concat(ifds[0].subIFD);
          for (var i = 0; i < vsns.length; i++) {
            var img = vsns[i];
            if (img["t258"] == null || img["t258"].length < 3) continue;
            var ar = img["t256"] * img["t257"];
            if (ar > ma) {
              ma = ar;
              page = img;
            }
          }
          UTIF2.decodeImage(buff, page, ifds);
          var rgba = UTIF2.toRGBA8(page), w = page.width, h = page.height;
          var ind = UTIF2._xhrs.indexOf(e.target), img = UTIF2._imgs[ind];
          UTIF2._xhrs.splice(ind, 1);
          UTIF2._imgs.splice(ind, 1);
          var cnv = document.createElement("canvas");
          cnv.width = w;
          cnv.height = h;
          var ctx = cnv.getContext("2d"), imgd = ctx.createImageData(w, h);
          for (var i = 0; i < rgba.length; i++) imgd.data[i] = rgba[i];
          ctx.putImageData(imgd, 0, 0);
          img.setAttribute("src", cnv.toDataURL());
        };
        UTIF2._binBE = {
          nextZero: function(data, o) {
            while (data[o] != 0) o++;
            return o;
          },
          readUshort: function(buff, p) {
            return buff[p] << 8 | buff[p + 1];
          },
          readShort: function(buff, p) {
            var a = UTIF2._binBE.ui8;
            a[0] = buff[p + 1];
            a[1] = buff[p + 0];
            return UTIF2._binBE.i16[0];
          },
          readInt: function(buff, p) {
            var a = UTIF2._binBE.ui8;
            a[0] = buff[p + 3];
            a[1] = buff[p + 2];
            a[2] = buff[p + 1];
            a[3] = buff[p + 0];
            return UTIF2._binBE.i32[0];
          },
          readUint: function(buff, p) {
            var a = UTIF2._binBE.ui8;
            a[0] = buff[p + 3];
            a[1] = buff[p + 2];
            a[2] = buff[p + 1];
            a[3] = buff[p + 0];
            return UTIF2._binBE.ui32[0];
          },
          readASCII: function(buff, p, l) {
            var s = "";
            for (var i = 0; i < l; i++) s += String.fromCharCode(buff[p + i]);
            return s;
          },
          readFloat: function(buff, p) {
            var a = UTIF2._binBE.ui8;
            for (var i = 0; i < 4; i++) a[i] = buff[p + 3 - i];
            return UTIF2._binBE.fl32[0];
          },
          readDouble: function(buff, p) {
            var a = UTIF2._binBE.ui8;
            for (var i = 0; i < 8; i++) a[i] = buff[p + 7 - i];
            return UTIF2._binBE.fl64[0];
          },
          writeUshort: function(buff, p, n) {
            buff[p] = n >> 8 & 255;
            buff[p + 1] = n & 255;
          },
          writeUint: function(buff, p, n) {
            buff[p] = n >> 24 & 255;
            buff[p + 1] = n >> 16 & 255;
            buff[p + 2] = n >> 8 & 255;
            buff[p + 3] = n >> 0 & 255;
          },
          writeASCII: function(buff, p, s) {
            for (var i = 0; i < s.length; i++) buff[p + i] = s.charCodeAt(i);
          },
          writeDouble: function(buff, p, n) {
            UTIF2._binBE.fl64[0] = n;
            for (var i = 0; i < 8; i++) buff[p + i] = UTIF2._binBE.ui8[7 - i];
          }
        };
        UTIF2._binBE.ui8 = new Uint8Array(8);
        UTIF2._binBE.i16 = new Int16Array(UTIF2._binBE.ui8.buffer);
        UTIF2._binBE.i32 = new Int32Array(UTIF2._binBE.ui8.buffer);
        UTIF2._binBE.ui32 = new Uint32Array(UTIF2._binBE.ui8.buffer);
        UTIF2._binBE.fl32 = new Float32Array(UTIF2._binBE.ui8.buffer);
        UTIF2._binBE.fl64 = new Float64Array(UTIF2._binBE.ui8.buffer);
        UTIF2._binLE = {
          nextZero: UTIF2._binBE.nextZero,
          readUshort: function(buff, p) {
            return buff[p + 1] << 8 | buff[p];
          },
          readShort: function(buff, p) {
            var a = UTIF2._binBE.ui8;
            a[0] = buff[p + 0];
            a[1] = buff[p + 1];
            return UTIF2._binBE.i16[0];
          },
          readInt: function(buff, p) {
            var a = UTIF2._binBE.ui8;
            a[0] = buff[p + 0];
            a[1] = buff[p + 1];
            a[2] = buff[p + 2];
            a[3] = buff[p + 3];
            return UTIF2._binBE.i32[0];
          },
          readUint: function(buff, p) {
            var a = UTIF2._binBE.ui8;
            a[0] = buff[p + 0];
            a[1] = buff[p + 1];
            a[2] = buff[p + 2];
            a[3] = buff[p + 3];
            return UTIF2._binBE.ui32[0];
          },
          readASCII: UTIF2._binBE.readASCII,
          readFloat: function(buff, p) {
            var a = UTIF2._binBE.ui8;
            for (var i = 0; i < 4; i++) a[i] = buff[p + i];
            return UTIF2._binBE.fl32[0];
          },
          readDouble: function(buff, p) {
            var a = UTIF2._binBE.ui8;
            for (var i = 0; i < 8; i++) a[i] = buff[p + i];
            return UTIF2._binBE.fl64[0];
          }
        };
        UTIF2._copyTile = function(tb, tw, th, b, w, h, xoff, yoff) {
          var xlim = Math.min(tw, w - xoff);
          var ylim = Math.min(th, h - yoff);
          for (var y = 0; y < ylim; y++) {
            var tof = (yoff + y) * w + xoff;
            var sof = y * tw;
            for (var x = 0; x < xlim; x++) b[tof + x] = tb[sof + x];
          }
        };
        UTIF2.LosslessJpegDecode = (function() {
          function t(Z) {
            this.w = Z;
            this.N = 0;
            this._ = 0;
            this.G = 0;
          }
          t.prototype = { t: function(Z) {
            this.N = Math.max(0, Math.min(this.w.length, Z));
          }, i: function() {
            return this.w[this.N++];
          }, l: function() {
            var Z = this.N;
            this.N += 2;
            return this.w[Z] << 8 | this.w[Z + 1];
          }, J: function() {
            if (this._ == 0) {
              this.G = this.w[this.N];
              this.N += 1 + (this.G + 1 >>> 8);
              this._ = 8;
            }
            return this.G >>> --this._ & 1;
          }, Z: function(Z) {
            var X = this._, s = this.G, E = Math.min(X, Z);
            Z -= E;
            X -= E;
            var Y = s >>> X & (1 << E) - 1;
            while (Z > 0) {
              s = this.w[this.N];
              this.N += 1 + (s + 1 >>> 8);
              E = Math.min(8, Z);
              Z -= E;
              X = 8 - E;
              Y <<= E;
              Y |= s >>> X & (1 << E) - 1;
            }
            this._ = X;
            this.G = s;
            return Y;
          } };
          var i = {};
          i.X = function() {
            return [0, 0, -1];
          };
          i.s = function(Z, X, s) {
            Z[i.Y(Z, 0, s) + 2] = X;
          };
          i.Y = function(Z, X, s) {
            if (Z[X + 2] != -1) return 0;
            if (s == 0) return X;
            for (var E = 0; E < 2; E++) {
              if (Z[X + E] == 0) {
                Z[X + E] = Z.length;
                Z.push(0);
                Z.push(0);
                Z.push(-1);
              }
              var Y = i.Y(Z, Z[X + E], s - 1);
              if (Y != 0) return Y;
            }
            return 0;
          };
          i.B = function(Z, X) {
            var s = 0, E = 0, Y = 0, B = X._, $ = X.G, e = X.N;
            while (true) {
              if (B == 0) {
                $ = X.w[e];
                e += 1 + ($ + 1 >>> 8);
                B = 8;
              }
              Y = $ >>> --B & 1;
              s = Z[s + Y];
              E = Z[s + 2];
              if (E != -1) {
                X._ = B;
                X.G = $;
                X.N = e;
                return E;
              }
            }
            return -1;
          };
          function l(Z) {
            this.z = new t(Z);
            this.D(this.z);
          }
          l.prototype = { $: function(Z, X) {
            this.Q = Z.i();
            this.F = Z.l();
            this.o = Z.l();
            var s = this.O = Z.i();
            this.L = [];
            for (var E = 0; E < s; E++) {
              var Y = Z.i(), B = Z.i();
              Z.i();
              this.L[Y] = E;
            }
            Z.t(Z.N + X - (6 + s * 3));
          }, e: function() {
            var Z = 0, X = this.z.i();
            if (this.H == null) this.H = {};
            var s = this.H[X] = i.X(), E = [];
            for (var Y = 0; Y < 16; Y++) {
              E[Y] = this.z.i();
              Z += E[Y];
            }
            for (var Y = 0; Y < 16; Y++) for (var B = 0; B < E[Y]; B++) i.s(s, this.z.i(), Y + 1);
            return Z + 17;
          }, W: function(Z) {
            while (Z > 0) Z -= this.e();
          }, p: function(Z, X) {
            var s = Z.i();
            if (!this.U) {
              this.U = [];
            }
            for (var E = 0; E < s; E++) {
              var Y = Z.i(), B = Z.i();
              this.U[this.L[Y]] = this.H[B >>> 4];
            }
            this.g = Z.i();
            Z.t(Z.N + X - (2 + s * 2));
          }, D: function(Z) {
            var X = false, s = Z.l();
            if (s !== l.q) return;
            do {
              var s = Z.l(), E = Z.l() - 2;
              switch (s) {
                case l.m:
                  this.$(Z, E);
                  break;
                case l.K:
                  this.W(E);
                  break;
                case l.V:
                  this.p(Z, E);
                  X = true;
                  break;
                default:
                  Z.t(Z.N + E);
                  break;
              }
            } while (!X);
          }, I: function(Z, X) {
            var s = i.B(X, Z);
            if (s == 16) return -32768;
            var E = Z.Z(s);
            if ((E & 1 << s - 1) == 0) E -= (1 << s) - 1;
            return E;
          }, B: function(Z, X) {
            var s = this.z, E = this.O, Y = this.F, B = this.I, $ = this.g, e = this.o * E, W = this.U;
            for (var p = 0; p < E; p++) {
              Z[p] = B(s, W[p]) + (1 << this.Q - 1);
            }
            for (var D = E; D < e; D += E) {
              for (var p = 0; p < E; p++) Z[D + p] = B(s, W[p]) + Z[D + p - E];
            }
            var I = X;
            for (var m = 1; m < Y; m++) {
              for (var p = 0; p < E; p++) {
                Z[I + p] = B(s, W[p]) + Z[I + p - X];
              }
              for (var D = E; D < e; D += E) {
                for (var p = 0; p < E; p++) {
                  var K = I + D + p, q = Z[K - E];
                  if ($ == 6) q = Z[K - X] + (q - Z[K - E - X] >>> 1);
                  Z[K] = q + B(s, W[p]);
                }
              }
              I += X;
            }
          } };
          l.m = 65475;
          l.K = 65476;
          l.q = 65496;
          l.V = 65498;
          function J(Z) {
            var X = new l(Z), s = X.Q > 8 ? Uint16Array : Uint8Array, E = new s(X.o * X.F * X.O), Y = X.o * X.O;
            X.B(E, Y);
            return E;
          }
          return J;
        })();
      })(UTIF, pako);
    })();
  }
});

// packages/viewer-image/src/workers/tiff.worker.ts
var import_utif = __toESM(require_UTIF(), 1);
var MAX_DIMENSION = 16384;
var MAX_OUTPUT_BYTES = 256 * 1024 * 1024;
self.onmessage = (e) => {
  const { data, type } = e.data;
  if (type !== "decode-tiff") return;
  try {
    const bytes = new Uint8Array(data);
    const ifds = import_utif.default.decode(bytes);
    if (ifds.length === 0) {
      self.postMessage({ error: "TIFF contains no images" });
      return;
    }
    const frames = [];
    for (let i = 0; i < ifds.length; i++) {
      const ifd = ifds[i];
      if (!ifd) continue;
      const declaredW = ifd.t256?.[0] ?? 0;
      const declaredH = ifd.t257?.[0] ?? 0;
      if (declaredW > MAX_DIMENSION || declaredH > MAX_DIMENSION) {
        self.postMessage({
          error: `TIFF dimensions (${declaredW}x${declaredH}) exceed max ${MAX_DIMENSION}`
        });
        return;
      }
      const outputBytes = declaredW * declaredH * 4;
      if (outputBytes > MAX_OUTPUT_BYTES) {
        self.postMessage({
          error: `TIFF output size ${outputBytes} exceeds max ${MAX_OUTPUT_BYTES}`
        });
        return;
      }
      import_utif.default.decodeImage(bytes, ifd, ifds);
      const w = ifd.width ?? declaredW;
      const h = ifd.height ?? declaredH;
      const rgba = import_utif.default.toRGBA8(ifd);
      const buffer = rgba.buffer.slice(0);
      frames.push({ data: buffer, width: w, height: h });
    }
    self.postMessage(
      { frames, pages: ifds.length },
      { transfer: frames.map((f) => f.data) }
    );
  } catch (err) {
    self.postMessage({ error: err.message || "TIFF decode failed" });
  }
};
