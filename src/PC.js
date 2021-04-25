const PC1 = function () {
  this.hexCharsToBytes =
    this.hexCharsToBytes ||
    (function () {
      var C = new Array(256);
      var D;
      for (D = 0; D < 10; ++D) {
        C[48 + D] = D;
      }
      for (D = 0; D < 6; ++D) {
        C[97 + D] = 10 + D;
        C[65 + D] = 10 + D;
      }
      return C;
    })();
  this.bytesToHexChars = "0123456789abcdef";
};
PC1.prototype = {
  encrypt: function (F, D) {
    var E = this.pc1(this.hexToBytes(F), this.hexToBytes(D), false);
    return this.bytesToHex(E);
  },
  decrypt: function (F, D) {
    var E = this.pc1(this.hexToBytes(F), this.hexToBytes(D), true);
    return this.bytesToHex(E);
  },
  pc1: function (Z, R, P) {
    if (typeof Z == "string" || typeof R == "string") {
      throw "invalid data tyep: src or key";
    }
    var b = R.length;
    var W = Z.length;
    if (b != 16) {
      throw "Key length should be 16";
    }
    var a = new Array();
    var X = new Array();
    var d;
    var T = 0,
      c = 0;
    var S = 0;
    for (d = 0; d < 8; ++d) {
      X[d] = (R[d << 1] << 8) | R[(d << 1) + 1];
    }
    for (d = 0; d < W; ++d) {
      var V = 0,
        Q = 0;
      var U;
      for (var Y = 0; Y < 8; ++Y) {
        V ^= X[Y];
        c = (c + Y) * 20021 + T;
        T = (V * 346) & 65535;
        c = (c + T) & 65535;
        V = (V * 20021 + 1) & 65535;
        Q ^= V ^ c;
      }
      U = Z[d];
      if (!P) {
        S = U * 257;
      }
      U = (U ^ (Q >> 8) ^ Q) & 255;
      if (P) {
        S = U * 257;
      }
      for (Y = 0; Y < 8; ++Y) {
        X[Y] ^= S;
      }
      a[d] = U;
    }
    return a;
  },
  stringToBytes: function (G) {
    var I,
      F,
      J = [];
    for (var H = 0; H < G.length; H++) {
      I = G.charCodeAt(H);
      F = [];
      do {
        F.push(I & 255);
        I = I >> 8;
      } while (I);
      J = J.concat(F.reverse());
    }
    return J;
  },
  utf16ToBytes: function (G) {
    var I,
      F,
      J = new Array(G.length << 1);
    for (var H = 0; H < G.length; H++) {
      I = G.charCodeAt(H);
      J[H * 2] = I >> 8;
      J[H * 2 + 1] = I & 255;
    }
    return J;
  },
  bytesToUtf16: function (G) {
    var E = new Array(G >> 1);
    var H;
    for (var F = 0; F < G.length; F += 2) {
      H = (G[F] << 8) | G[F + 1];
      E[F] = String.fromCharCode(H);
    }
    return E.join("");
  },
  hexToBytes: function (H) {
    var I, J;
    var F = new Array(H.length / 2);
    for (var G = 0; G < H.length; G += 2) {
      I = H.charCodeAt(G);
      J = H.charCodeAt(G + 1);
      F[G / 2] = (this.hexCharsToBytes[I] << 4) | this.hexCharsToBytes[J];
    }
    return F;
  },
  bytesToHex: function (F) {
    var D = new Array(F.length << 1);
    for (var E = 0; E < F.length; ++E) {
      D[E * 2] = this.bytesToHexChars.charAt((F[E] & 240) >> 4);
      D[E * 2 + 1] = this.bytesToHexChars.charAt(F[E] & 15);
    }
    return D.join("");
  },
};

const encrypt = (D) => {
  const pc1 = new PC1();
  return pc1.bytesToHex(
    pc1.pc1(pc1.utf16ToBytes(D), pc1.stringToBytes("0000000000000000"), false)
  );
};

const decrypt = (F) => {
  const pc1 = new PC1();
  return pc1.bytesToUtf16(
    pc1.pc1(pc1.hexToBytes(F), pc1.stringToBytes("0000000000000000"), true)
  );
};

const format = (data) => {
  let dataRet;
  try {
    dataRet = eval("(" + data + ")");
  } catch (E) {
    dataRet = eval(data);
  }
  return dataRet;
};

const formatContent = (data) => {
  let dataRet;
  try {
    dataRet = eval("(" + decrypt(data) + ")");
  } catch (E) {
    dataRet = eval(decrypt(data));
  }
  return dataRet;
};

module.exports = {
  encrypt,
  decrypt,
  format,
  formatContent,
};
