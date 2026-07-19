/*
 * cockpit-ui.js -- Bausteine der Oberflaeche (Task V18.6b, Design-Spec 4.7).
 *
 * Ein Modul ohne Abhaengigkeiten. Im Browser haengt es sich an
 * `window.Cockpit.ui`, unter Node (jsdom-Tests) liefert es zusaetzlich
 * `module.exports`. Das Stylesheet der jeweiligen Seite bringt die Klassen mit
 * (Abschnitt "Design-System-Bausteine (V18.6b)" in site/index.html); dieses
 * Modul setzt ausser Position und Gleiter-Verschiebung keine Farben oder Masse.
 *
 * Grundsatz aus der Spec: kein Nutzertext geht je als Markup in die Seite.
 * Beschriftungen werden ausschliesslich ueber `textContent` gesetzt, das
 * einzige innerHTML ist die Symbol-Sprite, deren Namen vorher gegen die feste
 * Liste SYMBOLE geprueft werden.
 */
(function () {
  "use strict";

  // Die 32 Symbole der Sprite (Design-Spec 4.7). Nur diese Namen ergeben ein
  // <use>-Markup, alles andere liefert einen leeren String.
  var SYMBOLE = [
    "kerzen", "linie", "flaeche", "heikin", "hohl", "indikator", "zeichnen",
    "trend", "horizontal", "vertikal", "rechteck", "ellipse", "fibo",
    "position-long", "position-short", "massband", "notiz", "analyse",
    "vergleich", "optionen", "layout", "vollbild", "teilen", "auge", "auge-zu",
    "zahnrad", "kreuz", "plus", "chevron", "suche", "alarm", "stern"
  ];

  // Unterhalb dieser Fensterbreite wird aus jedem Popover ein Sheet.
  var SHEET_SCHWELLE = 720;
  // Wischweg nach unten, ab dem ein Sheet schliesst.
  var WISCH_SCHWELLE = 80;

  // ---------------------------------------------------------------------
  // Kleine Helfer
  // ---------------------------------------------------------------------

  function fenster() {
    if (typeof window !== "undefined" && window) { return window; }
    if (typeof document !== "undefined" && document && document.defaultView) {
      return document.defaultView;
    }
    return {};
  }

  function fensterBreite() {
    return fenster().innerWidth || 1280;
  }

  function bau(tag, klasse, text) {
    var element = document.createElement(tag);
    if (klasse) { element.className = klasse; }
    if (text !== undefined && text !== null) { element.textContent = String(text); }
    return element;
  }

  function alsText(wert) {
    return wert === undefined || wert === null ? "" : String(wert);
  }

  function sichtbar(element) {
    return !element.hidden;
  }

  function reduzierteBewegung() {
    var f = fenster();
    if (!f.matchMedia) { return false; }
    try {
      return f.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch (fehler) {
      return false;
    }
  }

  // ---------------------------------------------------------------------
  // symbol
  // ---------------------------------------------------------------------

  function symbol(name) {
    if (SYMBOLE.indexOf(name) < 0) { return ""; }
    return '<svg class="symbol" aria-hidden="true"><use href="#s-' + name + '"/></svg>';
  }

  function setzeSymbol(halter, name) {
    var markup = symbol(name);
    if (markup) {
      halter.innerHTML = markup;  // sicher: name kommt aus SYMBOLE
    } else {
      halter.textContent = "";
    }
    return markup !== "";
  }

  // ---------------------------------------------------------------------
  // segmented
  // ---------------------------------------------------------------------

  function segmented(container, optionen, aktiv, onWechsel) {
    var gruppe = bau("div", "segmented");
    gruppe.setAttribute("role", "radiogroup");
    var gleiter = bau("span", "segmented-gleiter");
    gleiter.setAttribute("aria-hidden", "true");
    gruppe.appendChild(gleiter);

    var knoepfe = (optionen || []).map(function (option) {
      var knopf = bau("button", "segmented-option");
      knopf.type = "button";
      knopf.setAttribute("role", "radio");
      knopf.setAttribute("data-wert", alsText(option.wert));
      if (option.symbol) {
        var halter = bau("span", "zeile-symbol");
        setzeSymbol(halter, option.symbol);
        knopf.appendChild(halter);
      }
      knopf.appendChild(bau("span", "segmented-label", option.label));
      gruppe.appendChild(knopf);
      return knopf;
    });

    var aktuell = null;

    function verschiebeGleiter(knopf, sofort) {
      // Der gleitende Hintergrund folgt per transform, damit nichts umbricht.
      // `sofort` springt ohne Animation: beim ersten Aufbau und immer dann,
      // wenn die Gruppe erst sichtbar wird (vorher sind alle Masse 0).
      if (sofort) { gleiter.style.transition = "none"; }
      gleiter.style.width = (knopf.offsetWidth || 0) + "px";
      gleiter.style.transform = "translateX(" + (knopf.offsetLeft || 0) + "px)";
      if (!sofort) { return; }
      var f = fenster();
      if (f.requestAnimationFrame) {
        f.requestAnimationFrame(function () { gleiter.style.transition = ""; });
      } else {
        gleiter.style.transition = "";
      }
    }

    function gewaehlterKnopf() {
      for (var i = 0; i < knoepfe.length; i += 1) {
        if (knoepfe[i].getAttribute("aria-checked") === "true") { return knoepfe[i]; }
      }
      return null;
    }

    function waehle(wert, melden) {
      var text = alsText(wert);
      if (aktuell === text) { return; }
      var treffer = null;
      knoepfe.forEach(function (knopf) {
        var eigen = knopf.getAttribute("data-wert") === text;
        knopf.setAttribute("aria-checked", eigen ? "true" : "false");
        knopf.tabIndex = eigen ? 0 : -1;
        if (eigen) { treffer = knopf; }
      });
      if (!treffer) { return; }
      verschiebeGleiter(treffer, !melden);
      aktuell = text;
      if (melden && typeof onWechsel === "function") { onWechsel(aktuell); }
    }

    gruppe.addEventListener("click", function (ereignis) {
      var knopf = ereignis.target.closest("[data-wert]");
      if (!knopf || knoepfe.indexOf(knopf) < 0) { return; }
      waehle(knopf.getAttribute("data-wert"), true);
      knopf.focus();
    });

    gruppe.addEventListener("keydown", function (ereignis) {
      var richtung = 0;
      if (ereignis.key === "ArrowRight" || ereignis.key === "ArrowDown") { richtung = 1; }
      if (ereignis.key === "ArrowLeft" || ereignis.key === "ArrowUp") { richtung = -1; }
      if (!richtung) { return; }
      ereignis.preventDefault();
      var stelle = knoepfe.indexOf(document.activeElement);
      if (stelle < 0) {
        stelle = knoepfe.map(function (knopf) {
          return knopf.getAttribute("aria-checked");
        }).indexOf("true");
      }
      var ziel = knoepfe[(stelle + richtung + knoepfe.length) % knoepfe.length];
      waehle(ziel.getAttribute("data-wert"), true);
      ziel.focus();
    });

    if (container) {
      container.textContent = "";
      container.appendChild(gruppe);
    }
    waehle(aktiv, false);

    // Die Gruppe kann verborgen gebaut werden (das Dashboard baut sie vor dem
    // Entsperren). Sobald sie Masse bekommt, sitzt der Gleiter neu.
    var Beobachter = fenster().ResizeObserver;
    if (Beobachter) {
      new Beobachter(function () {
        var knopf = gewaehlterKnopf();
        if (knopf) { verschiebeGleiter(knopf, true); }
      }).observe(gruppe);
    }

    return {
      element: gruppe,
      setze: function (wert) { waehle(wert, false); }
    };
  }

  // ---------------------------------------------------------------------
  // schalter
  // ---------------------------------------------------------------------

  function schalter(label, aktiv, onWechsel) {
    var zeile = bau("div", "schalter-zeile");
    zeile.appendChild(bau("span", "schalter-label", label));
    // Bewusst ein div statt eines <button>: ein Knopf loest bei der Leertaste
    // zusaetzlich ein click aus, der Schalter wuerde doppelt umspringen.
    var knopf = bau("div", "schalter");
    knopf.setAttribute("role", "switch");
    knopf.setAttribute("aria-checked", aktiv ? "true" : "false");
    knopf.setAttribute("aria-label", alsText(label));
    knopf.tabIndex = 0;
    knopf.appendChild(bau("span", "schalter-knauf"));
    zeile.appendChild(knopf);

    function wechsle() {
      var neu = knopf.getAttribute("aria-checked") !== "true";
      knopf.setAttribute("aria-checked", neu ? "true" : "false");
      if (typeof onWechsel === "function") { onWechsel(neu); }
    }

    knopf.addEventListener("click", wechsle);
    knopf.addEventListener("keydown", function (ereignis) {
      if (ereignis.key !== " " && ereignis.key !== "Enter" && ereignis.key !== "Spacebar") { return; }
      ereignis.preventDefault();
      wechsle();
    });
    return zeile;
  }

  // ---------------------------------------------------------------------
  // feld
  // ---------------------------------------------------------------------

  function nachkommastellen(schritt) {
    var teile = String(schritt).split(".");
    return teile.length > 1 ? teile[1].length : 0;
  }

  function feld(label, wert, optionen) {
    var opt = optionen || {};
    var typ = opt.typ || "text";
    var schritt = typeof opt.schritt === "number" ? opt.schritt : 1;
    var zeile = bau("div", "feld-zeile");
    var beschriftung = bau("label", "feld-label", label);
    zeile.appendChild(beschriftung);

    var kasten = bau("div", "feld-eingabe");
    var eingabe = document.createElement("input");
    eingabe.className = "feld-input";
    eingabe.type = typ === "zahl" ? "number" : (typ === "farbe" ? "color" : "text");
    eingabe.value = alsText(wert);
    var kennung = "feld-" + Math.random().toString(36).slice(2, 9);
    eingabe.id = kennung;
    beschriftung.setAttribute("for", kennung);

    function begrenze(zahl) {
      if (typeof opt.max === "number") { zahl = Math.min(zahl, opt.max); }
      if (typeof opt.min === "number") { zahl = Math.max(zahl, opt.min); }
      return Number(zahl.toFixed(nachkommastellen(schritt)));
    }

    function melde(neu) {
      if (typeof opt.onWechsel === "function") { opt.onWechsel(neu); }
    }

    if (typ === "zahl") {
      if (typeof opt.min === "number") { eingabe.min = String(opt.min); }
      if (typeof opt.max === "number") { eingabe.max = String(opt.max); }
      eingabe.step = String(schritt);

      // Das Minus ist das echte Minuszeichen U+2212, damit es zum Plus passt.
      [["−", -1, "Weniger"], ["+", 1, "Mehr"]].forEach(function (angabe) {
        var knopf = bau("button", "feld-stepper", angabe[0]);
        knopf.type = "button";
        knopf.setAttribute("aria-label", angabe[2] + ", " + alsText(label));
        knopf.addEventListener("click", function () {
          var aktuell = parseFloat(eingabe.value);
          if (isNaN(aktuell)) { aktuell = typeof opt.min === "number" ? opt.min : 0; }
          var neu = begrenze(aktuell + angabe[1] * schritt);
          if (neu === aktuell) { return; }
          eingabe.value = String(neu);
          melde(neu);
        });
        if (angabe[1] < 0) { kasten.appendChild(knopf); }
        else { kasten.appendChild(eingabe); kasten.appendChild(knopf); }
      });
    } else {
      kasten.appendChild(eingabe);
    }

    eingabe.addEventListener("change", function () {
      if (typ === "zahl") {
        var zahl = parseFloat(eingabe.value);
        if (isNaN(zahl)) { return; }
        var neu = begrenze(zahl);
        eingabe.value = String(neu);
        melde(neu);
        return;
      }
      melde(eingabe.value);
    });

    zeile.appendChild(kasten);
    return zeile;
  }

  // ---------------------------------------------------------------------
  // toast
  // ---------------------------------------------------------------------

  function toast(text, optionen) {
    var opt = optionen || {};
    var bereich = document.getElementById("toast-bereich");
    if (!bereich) {
      bereich = bau("div");
      bereich.id = "toast-bereich";
      bereich.setAttribute("aria-live", "polite");
      document.body.appendChild(bereich);
    }
    var meldung = bau("div", "toast toast-" + (opt.art || "info"), text);
    meldung.setAttribute("role", "status");
    bereich.appendChild(meldung);
    var dauer = typeof opt.dauer === "number" ? opt.dauer : 3000;
    fenster().setTimeout(function () {
      if (meldung.parentNode) { meldung.parentNode.removeChild(meldung); }
    }, dauer);
    return meldung;
  }

  // ---------------------------------------------------------------------
  // Gemeinsame Menue-Flaeche fuer popover, Untermenues und sheet
  // ---------------------------------------------------------------------

  /**
   * Baut Titel, Suchfeld, Gruppen und Fuss in `flaeche` und verdrahtet
   * Tastatur, Filter und Aktionen. `kontext` liefert:
   *   schliesseGanz()          -- schliesst die ganze Kette
   *   oeffneUnter(zeile, spec) -- oeffnet ein Untermenue
   *   vorspann                 -- optionale Elemente ganz oben (Zurueck-Zeile)
   */
  function fuelleFlaeche(flaeche, spec, kontext) {
    var suchfeld = null;
    var zeilen = [];

    if (kontext.vorspann) {
      kontext.vorspann.forEach(function (element) { flaeche.appendChild(element); });
    }
    if (spec.titel) {
      flaeche.appendChild(bau("div", "popover-titel", spec.titel));
    }
    if (spec.suche) {
      var suchkasten = bau("div", "popover-suche");
      suchfeld = document.createElement("input");
      suchfeld.type = "search";
      suchfeld.className = "popover-suchfeld";
      suchfeld.placeholder = "Suchen";
      suchfeld.setAttribute("aria-label", "Suchen");
      suchkasten.appendChild(suchfeld);
      flaeche.appendChild(suchkasten);
    }

    var inhalt = bau("div", "popover-inhalt");
    flaeche.appendChild(inhalt);

    (spec.gruppen || []).forEach(function (gruppenSpec) {
      var gruppe = bau("div", "popover-gruppe");
      if (gruppenSpec.titel) {
        gruppe.appendChild(bau("div", "popover-gruppen-titel", gruppenSpec.titel));
      }
      (gruppenSpec.zeilen || []).forEach(function (zeilenSpec) {
        var zeile = baueZeile(zeilenSpec, kontext);
        gruppe.appendChild(zeile);
        zeilen.push(zeile);
      });
      inhalt.appendChild(gruppe);
    });

    if (spec.fuss && spec.fuss.length) {
      var fuss = bau("div", "popover-fuss");
      spec.fuss.forEach(function (eintrag) {
        var knopf = bau("button", "popover-fuss-knopf", eintrag.label);
        knopf.type = "button";
        knopf.addEventListener("click", function () {
          if (typeof eintrag.aktion === "function") { eintrag.aktion(); }
          kontext.schliesseGanz();
        });
        fuss.appendChild(knopf);
      });
      flaeche.appendChild(fuss);
    }

    function sichtbareZeilen() {
      return zeilen.filter(sichtbar);
    }

    function fokussierbare() {
      var liste = [];
      if (suchfeld) { liste.push(suchfeld); }
      liste = liste.concat(sichtbareZeilen());
      Array.prototype.forEach.call(flaeche.querySelectorAll(".popover-fuss button, .sheet-zurueck"),
        function (element) { liste.push(element); });
      return liste;
    }

    function fokussiere(index) {
      var liste = sichtbareZeilen();
      if (!liste.length) { return; }
      var stelle = ((index % liste.length) + liste.length) % liste.length;
      liste[stelle].focus();
    }

    function stelleVonFokus() {
      return sichtbareZeilen().indexOf(document.activeElement);
    }

    function filtere(begriff) {
      var such = String(begriff || "").trim().toLowerCase();
      zeilen.forEach(function (zeile) {
        zeile.hidden = such !== "" && (zeile.getAttribute("data-label") || "").indexOf(such) < 0;
      });
      Array.prototype.forEach.call(inhalt.querySelectorAll(".popover-gruppe"), function (gruppe) {
        gruppe.hidden = gruppe.querySelectorAll(".popover-zeile:not([hidden])").length === 0;
      });
    }

    if (suchfeld) {
      suchfeld.addEventListener("input", function () { filtere(suchfeld.value); });
    }

    function aufTaste(ereignis) {
      var taste = ereignis.key;
      if (taste === "Escape") {
        ereignis.preventDefault();
        ereignis.cockpitErledigt = true;
        kontext.aufEscape();
        return;
      }
      if (taste === "Tab") {
        var liste = fokussierbare();
        if (!liste.length) { return; }
        ereignis.preventDefault();
        var stelle = liste.indexOf(document.activeElement);
        if (stelle < 0) { stelle = 0; }
        var schritt = ereignis.shiftKey ? -1 : 1;
        liste[((stelle + schritt) % liste.length + liste.length) % liste.length].focus();
        return;
      }
      if (taste === "ArrowDown" || taste === "ArrowUp") {
        ereignis.preventDefault();
        var stelleJetzt = stelleVonFokus();
        if (stelleJetzt < 0) {
          fokussiere(taste === "ArrowDown" ? 0 : -1);
        } else {
          fokussiere(stelleJetzt + (taste === "ArrowDown" ? 1 : -1));
        }
        return;
      }
      if (taste === "Home" || taste === "End") {
        ereignis.preventDefault();
        fokussiere(taste === "Home" ? 0 : sichtbareZeilen().length - 1);
        return;
      }
      if (taste === "Enter") {
        var ziel = document.activeElement;
        if (ziel === suchfeld) {
          var erste = sichtbareZeilen()[0];
          if (erste) { ereignis.preventDefault(); erste.cockpitAktiviere(); }
          return;
        }
        if (zeilen.indexOf(ziel) >= 0) {
          ereignis.preventDefault();
          ziel.cockpitAktiviere();
        }
        return;
      }
      if (taste === " " && zeilen.indexOf(document.activeElement) >= 0) {
        ereignis.preventDefault();
        document.activeElement.cockpitAktiviere();
        return;
      }
      // Tippen springt zur naechsten Zeile mit passendem Anfangsbuchstaben.
      if (taste.length === 1 && document.activeElement !== suchfeld
          && !ereignis.ctrlKey && !ereignis.metaKey && !ereignis.altKey) {
        var buchstabe = taste.toLowerCase();
        var liste2 = sichtbareZeilen();
        var start = liste2.indexOf(document.activeElement) + 1;
        for (var i = 0; i < liste2.length; i += 1) {
          var kandidat = liste2[(start + i) % liste2.length];
          if ((kandidat.getAttribute("data-label") || "").charAt(0) === buchstabe) {
            ereignis.preventDefault();
            kandidat.focus();
            return;
          }
        }
      }
    }

    flaeche.addEventListener("keydown", aufTaste);

    return {
      suchfeld: suchfeld,
      zeilen: zeilen,
      filtere: filtere,
      ersterFokus: function () {
        if (suchfeld) { suchfeld.focus(); return; }
        fokussiere(0);
      },
      // Das Sheet zeichnet dieselbe Flaeche mehrfach neu; ohne diesen
      // Ausstieg bliebe je Ebene eine Bindung auf alten Zeilen liegen.
      entbinde: function () { flaeche.removeEventListener("keydown", aufTaste); }
    };
  }

  function baueZeile(zeilenSpec, kontext) {
    var istSchalter = !!zeilenSpec.schalter;
    var zeile = bau("div", "popover-zeile");
    zeile.tabIndex = -1;
    zeile.setAttribute("role", istSchalter ? "menuitemcheckbox" : "menuitem");
    zeile.setAttribute("data-label", alsText(zeilenSpec.label).toLowerCase());
    if (istSchalter) {
      zeile.setAttribute("aria-checked", zeilenSpec.aktiv ? "true" : "false");
    }
    if (zeilenSpec.gefaehrlich) { zeile.classList.add("zeile-gefaehrlich"); }
    if (zeilenSpec.untermenue) { zeile.setAttribute("aria-haspopup", "menu"); }

    var symbolHalter = bau("span", "zeile-symbol");
    symbolHalter.setAttribute("aria-hidden", "true");
    setzeSymbol(symbolHalter, zeilenSpec.symbol);
    zeile.appendChild(symbolHalter);
    zeile.appendChild(bau("span", "zeile-label", zeilenSpec.label));

    if (zeilenSpec.wert !== undefined && zeilenSpec.wert !== null) {
      zeile.appendChild(bau("span", "zeile-wert", zeilenSpec.wert));
    }
    if (istSchalter) {
      var anzeige = bau("span", "zeile-schalter");
      anzeige.setAttribute("aria-hidden", "true");
      anzeige.appendChild(bau("span", "schalter-knauf"));
      zeile.appendChild(anzeige);
    } else if (zeilenSpec.untermenue) {
      var pfeil = bau("span", "zeile-pfeil");
      pfeil.setAttribute("aria-hidden", "true");
      setzeSymbol(pfeil, "chevron");
      zeile.appendChild(pfeil);
    }

    zeile.cockpitAktiviere = function () {
      if (zeilenSpec.untermenue) {
        kontext.oeffneUnter(zeile, zeilenSpec);
        return;
      }
      if (istSchalter) {
        var neu = zeile.getAttribute("aria-checked") !== "true";
        zeile.setAttribute("aria-checked", neu ? "true" : "false");
        if (typeof zeilenSpec.aktion === "function") { zeilenSpec.aktion(neu); }
        return;
      }
      if (typeof zeilenSpec.aktion === "function") { zeilenSpec.aktion(); }
      kontext.schliesseGanz();
    };

    zeile.addEventListener("click", function () { zeile.cockpitAktiviere(); });
    return zeile;
  }

  // ---------------------------------------------------------------------
  // popover
  // ---------------------------------------------------------------------

  // Offene Menues je Anker: ein zweiter Klick auf denselben Knopf soll kein
  // zweites Popover stapeln (der Klick-ausserhalb-Waechter laesst den Anker
  // bewusst durch, damit der Knopf sein eigenes Menue steuern kann).
  var offeneMenues = [];

  function schliesseFuerAnker(anker) {
    if (!anker) { return false; }
    var getroffen = false;
    offeneMenues.slice().forEach(function (eintrag) {
      if (eintrag.anker !== anker) { return; }
      getroffen = true;
      eintrag.schliesse(false);
    });
    return getroffen;
  }

  function merkeMenue(anker, schliesse) {
    if (!anker) { return function () {}; }
    var eintrag = { anker: anker, schliesse: schliesse };
    offeneMenues.push(eintrag);
    return function () {
      var stelle = offeneMenues.indexOf(eintrag);
      if (stelle >= 0) { offeneMenues.splice(stelle, 1); }
    };
  }

  function popover(anker, spec, elternteil) {
    // Ein zweiter Aufruf am selben Anker schliesst wieder: der
    // Klick-ausserhalb-Waechter laesst den Anker bewusst durch, damit sein
    // Knopf das eigene Menue auf- und zuklappen kann.
    if (!elternteil && schliesseFuerAnker(anker)) {
      return { element: null, schliesse: function () {} };
    }
    if (!elternteil && fensterBreite() < SHEET_SCHWELLE) {
      return sheetAusPopover(anker, spec);
    }

    var flaeche = bau("div", "popover");
    flaeche.setAttribute("role", "menu");
    if (spec.titel) { flaeche.setAttribute("aria-label", alsText(spec.titel)); }
    if (reduzierteBewegung()) { flaeche.classList.add("ohne-bewegung"); }

    var kind = null;
    var geschlossen = false;
    var vergiss = null;

    function schliesse(mitFokus) {
      if (geschlossen) { return; }
      geschlossen = true;
      if (vergiss) { vergiss(); }
      if (kind) { kind.schliesse(false); kind = null; }
      document.removeEventListener("mousedown", aufKlickAussen, true);
      document.removeEventListener("keydown", aufEscapeAussen, true);
      if (flaeche.parentNode) { flaeche.parentNode.removeChild(flaeche); }
      if (anker && !elternteil) {
        anker.setAttribute("aria-expanded", "false");
        if (mitFokus !== false && anker.focus) { anker.focus(); }
      }
      if (elternteil) { elternteil.kindGeschlossen(); }
    }

    function schliesseGanz() {
      if (elternteil) { elternteil.schliesseGanz(); return; }
      schliesse();
    }

    function aufKlickAussen(ereignis) {
      if (flaeche.contains(ereignis.target)) { return; }
      if (kind && kind.element.contains(ereignis.target)) { return; }
      if (anker && anker.contains && anker.contains(ereignis.target)) { return; }
      schliesse(false);
    }

    function aufEscapeAussen(ereignis) {
      if (ereignis.key !== "Escape" || ereignis.cockpitErledigt) { return; }
      if (kind) { return; }
      if (flaeche.contains(ereignis.target)) { return; }
      schliesse();
    }

    var kontext = {
      schliesseGanz: schliesseGanz,
      aufEscape: function () {
        if (kind) { kind.schliesse(); return; }
        schliesse();
      },
      oeffneUnter: function (zeile, zeilenSpec) {
        if (kind) { kind.schliesse(false); kind = null; }
        kind = popover(zeile, {
          titel: zeilenSpec.label,
          gruppen: zeilenSpec.untermenue
        }, {
          schliesseGanz: schliesseGanz,
          kindGeschlossen: function () {
            kind = null;
            if (!geschlossen && zeile.focus) { zeile.focus(); }
          }
        });
        kind.element.classList.add("popover-unter");
        positioniereRechts(kind.element, zeile, flaeche);
      }
    };

    var teile = fuelleFlaeche(flaeche, spec, kontext);
    document.body.appendChild(flaeche);
    if (anker) {
      if (!elternteil) {
        vergiss = merkeMenue(anker, schliesse);
        anker.setAttribute("aria-haspopup", "menu");
        anker.setAttribute("aria-expanded", "true");
      }
      positioniereUnter(flaeche, anker);
    }
    teile.ersterFokus();

    document.addEventListener("mousedown", aufKlickAussen, true);
    document.addEventListener("keydown", aufEscapeAussen, true);

    return { element: flaeche, schliesse: schliesse };
  }

  function positioniereUnter(flaeche, anker) {
    if (!anker.getBoundingClientRect) { return; }
    var kasten = anker.getBoundingClientRect();
    var f = fenster();
    var scrollX = f.scrollX || 0;
    var scrollY = f.scrollY || 0;
    var breite = flaeche.offsetWidth || 260;
    flaeche.style.top = (kasten.bottom + scrollY + 6) + "px";
    var links = kasten.left + scrollX;
    if (kasten.left + breite > fensterBreite() - 8) {
      // Rechtsbuendig, wenn es sonst aus dem Fenster laeuft.
      links = Math.max(8 + scrollX, kasten.right + scrollX - breite);
    }
    flaeche.style.left = links + "px";
  }

  function positioniereRechts(flaeche, zeile, eltern) {
    if (!zeile.getBoundingClientRect) { return; }
    var zeilenKasten = zeile.getBoundingClientRect();
    var elternKasten = eltern.getBoundingClientRect();
    var f = fenster();
    var breite = flaeche.offsetWidth || 240;
    var links = elternKasten.right + 4;
    if (links + breite > fensterBreite() - 8) {
      links = Math.max(8, elternKasten.left - breite - 4);
    }
    flaeche.style.left = (links + (f.scrollX || 0)) + "px";
    flaeche.style.top = (zeilenKasten.top + (f.scrollY || 0)) + "px";
  }

  // ---------------------------------------------------------------------
  // sheet
  // ---------------------------------------------------------------------

  function sheetAusPopover(anker, spec) {
    var vergiss = null;
    if (anker) {
      anker.setAttribute("aria-haspopup", "menu");
      anker.setAttribute("aria-expanded", "true");
    }
    var griff = sheet(spec, function (mitFokus) {
      if (vergiss) { vergiss(); }
      if (!anker) { return; }
      anker.setAttribute("aria-expanded", "false");
      if (mitFokus !== false && anker.focus) { anker.focus(); }
    });
    if (anker) { vergiss = merkeMenue(anker, griff.schliesse); }
    return griff;
  }

  function sheet(spec, beimSchliessen) {
    var overlay = bau("div", "sheet-overlay");
    var flaeche = bau("div", "sheet");
    flaeche.setAttribute("role", "dialog");
    flaeche.setAttribute("aria-modal", "true");
    if (spec.titel) { flaeche.setAttribute("aria-label", alsText(spec.titel)); }
    if (reduzierteBewegung()) { flaeche.classList.add("ohne-bewegung"); }
    overlay.appendChild(flaeche);

    var ebenen = [spec];
    var geschlossen = false;

    function schliesse(mitFokus) {
      if (geschlossen) { return; }
      geschlossen = true;
      if (teile) { teile.entbinde(); teile = null; }
      document.removeEventListener("keydown", aufEscapeAussen, true);
      if (overlay.parentNode) { overlay.parentNode.removeChild(overlay); }
      if (typeof beimSchliessen === "function") { beimSchliessen(mitFokus); }
    }

    function aufEscapeAussen(ereignis) {
      if (ereignis.key !== "Escape" || ereignis.cockpitErledigt) { return; }
      if (flaeche.contains(ereignis.target)) { return; }
      schliesse();
    }

    var teile = null;

    function zeichne() {
      if (teile) { teile.entbinde(); teile = null; }
      flaeche.textContent = "";
      var griffBereich = bau("div", "sheet-kopf");
      var griffStrich = bau("div", "sheet-griff");
      griffStrich.setAttribute("aria-hidden", "true");
      griffBereich.appendChild(griffStrich);
      flaeche.appendChild(griffBereich);
      verdrahteWischen(griffBereich);

      var vorspann = [];
      if (ebenen.length > 1) {
        var zurueck = bau("button", "sheet-zurueck");
        zurueck.type = "button";
        var pfeil = bau("span", "zeile-symbol");
        pfeil.setAttribute("aria-hidden", "true");
        setzeSymbol(pfeil, "chevron");
        zurueck.appendChild(pfeil);
        zurueck.appendChild(bau("span", "zeile-label", "Zurück"));
        zurueck.addEventListener("click", function () {
          ebenen.pop();
          zeichne();
        });
        vorspann.push(zurueck);
      }

      var kontext = {
        schliesseGanz: schliesse,
        aufEscape: function () { schliesse(); },
        vorspann: vorspann,
        oeffneUnter: function (zeile, zeilenSpec) {
          ebenen.push({ titel: zeilenSpec.label, gruppen: zeilenSpec.untermenue,
                        suche: false });
          zeichne();
        }
      };
      teile = fuelleFlaeche(flaeche, ebenen[ebenen.length - 1], kontext);
      teile.ersterFokus();
    }

    function verdrahteWischen(bereich) {
      var startY = null;
      bereich.addEventListener("pointerdown", function (ereignis) {
        startY = ereignis.clientY;
        if (bereich.setPointerCapture && ereignis.pointerId !== undefined) {
          try { bereich.setPointerCapture(ereignis.pointerId); } catch (fehler) { /* egal */ }
        }
      });
      bereich.addEventListener("pointermove", function (ereignis) {
        if (startY === null) { return; }
        var weg = Math.max(0, ereignis.clientY - startY);
        flaeche.style.transform = "translateY(" + weg + "px)";
      });
      function ende(ereignis) {
        if (startY === null) { return; }
        var weg = Math.max(0, (ereignis.clientY || 0) - startY);
        startY = null;
        flaeche.style.transform = "";
        if (weg >= WISCH_SCHWELLE) { schliesse(); }
      }
      bereich.addEventListener("pointerup", ende);
      bereich.addEventListener("pointercancel", ende);
    }

    overlay.addEventListener("mousedown", function (ereignis) {
      if (ereignis.target === overlay) { schliesse(); }
    });

    document.body.appendChild(overlay);
    document.addEventListener("keydown", aufEscapeAussen, true);
    zeichne();
    return { element: flaeche, schliesse: schliesse };
  }

  // ---------------------------------------------------------------------
  // befehlspalette
  // ---------------------------------------------------------------------

  function befehlspalette(quellenFn) {
    var overlay = null;

    function schliesse() {
      if (!overlay) { return; }
      if (overlay.parentNode) { overlay.parentNode.removeChild(overlay); }
      overlay = null;
    }

    function oeffne() {
      if (overlay) { return; }
      var eintraege = (typeof quellenFn === "function" ? quellenFn() : []) || [];
      overlay = bau("div", "palette-overlay");
      var flaeche = bau("div", "palette");
      flaeche.setAttribute("role", "dialog");
      flaeche.setAttribute("aria-modal", "true");
      flaeche.setAttribute("aria-label", "Befehle");
      overlay.appendChild(flaeche);

      var kennung = "palette-" + Math.random().toString(36).slice(2, 8);
      var suchfeld = document.createElement("input");
      suchfeld.type = "search";
      suchfeld.className = "palette-suchfeld";
      suchfeld.placeholder = "Befehl suchen";
      suchfeld.setAttribute("aria-label", "Befehl suchen");
      suchfeld.setAttribute("role", "combobox");
      suchfeld.setAttribute("aria-expanded", "true");
      suchfeld.setAttribute("aria-autocomplete", "list");
      suchfeld.setAttribute("aria-controls", kennung + "-liste");
      flaeche.appendChild(suchfeld);

      var liste = bau("div", "palette-liste");
      liste.id = kennung + "-liste";
      liste.setAttribute("role", "listbox");
      flaeche.appendChild(liste);

      var zeilen = [];
      var letzteGruppe = null;
      eintraege.forEach(function (eintrag) {
        if (eintrag.gruppe && eintrag.gruppe !== letzteGruppe) {
          letzteGruppe = eintrag.gruppe;
          var kopf = bau("div", "palette-gruppen-titel", eintrag.gruppe);
          liste.appendChild(kopf);
        }
        var zeile = bau("div", "palette-zeile");
        zeile.id = kennung + "-" + zeilen.length;
        zeile.setAttribute("role", "option");
        zeile.setAttribute("aria-selected", "false");
        zeile.setAttribute("data-suche",
          (alsText(eintrag.gruppe) + " " + alsText(eintrag.label)).toLowerCase());
        var symbolHalter = bau("span", "zeile-symbol");
        symbolHalter.setAttribute("aria-hidden", "true");
        setzeSymbol(symbolHalter, eintrag.symbol);
        zeile.appendChild(symbolHalter);
        zeile.appendChild(bau("span", "zeile-label", eintrag.label));
        zeile.cockpitAktion = eintrag.aktion;
        zeile.addEventListener("click", function () { fuehreAus(zeile); });
        liste.appendChild(zeile);
        zeilen.push(zeile);
      });

      var stelle = 0;

      function sichtbare() {
        return zeilen.filter(sichtbar);
      }

      function markiere() {
        var offen = sichtbare();
        if (stelle >= offen.length) { stelle = offen.length - 1; }
        if (stelle < 0) { stelle = 0; }
        zeilen.forEach(function (zeile) { zeile.setAttribute("aria-selected", "false"); });
        if (offen[stelle]) {
          offen[stelle].setAttribute("aria-selected", "true");
          // Der Fokus bleibt im Suchfeld, darum meldet aria-activedescendant
          // der Vorlesehilfe, welche Zeile gerade dran ist.
          suchfeld.setAttribute("aria-activedescendant", offen[stelle].id);
          if (offen[stelle].scrollIntoView) {
            offen[stelle].scrollIntoView({ block: "nearest" });
          }
        } else {
          suchfeld.removeAttribute("aria-activedescendant");
        }
      }

      function filtere() {
        var such = suchfeld.value.trim().toLowerCase();
        zeilen.forEach(function (zeile) {
          zeile.hidden = such !== "" && zeile.getAttribute("data-suche").indexOf(such) < 0;
        });
        Array.prototype.forEach.call(liste.querySelectorAll(".palette-gruppen-titel"),
          function (kopf) {
            var sichtbarInGruppe = false;
            var naechster = kopf.nextElementSibling;
            while (naechster && !naechster.classList.contains("palette-gruppen-titel")) {
              if (!naechster.hidden) { sichtbarInGruppe = true; }
              naechster = naechster.nextElementSibling;
            }
            kopf.hidden = !sichtbarInGruppe;
          });
        stelle = 0;
        markiere();
      }

      function fuehreAus(zeile) {
        var aktion = zeile.cockpitAktion;
        schliesse();
        if (typeof aktion === "function") { aktion(); }
      }

      function fokussierbare() {
        return Array.prototype.filter.call(
          flaeche.querySelectorAll('input, button, [tabindex]:not([tabindex="-1"])'),
          function (element) { return !element.hidden && !element.disabled; });
      }

      suchfeld.addEventListener("input", filtere);
      flaeche.addEventListener("keydown", function (ereignis) {
        if (ereignis.key === "Tab") {
          // aria-modal="true" verspricht eine Fokusfalle, also halten wir sie.
          var liste2 = fokussierbare();
          if (!liste2.length) { return; }
          ereignis.preventDefault();
          var stelle2 = liste2.indexOf(document.activeElement);
          if (stelle2 < 0) { stelle2 = 0; }
          var schritt = ereignis.shiftKey ? -1 : 1;
          liste2[((stelle2 + schritt) % liste2.length + liste2.length) % liste2.length].focus();
          return;
        }
        if (ereignis.key === "Escape") {
          ereignis.preventDefault();
          ereignis.cockpitErledigt = true;
          schliesse();
          return;
        }
        if (ereignis.key === "ArrowDown" || ereignis.key === "ArrowUp") {
          ereignis.preventDefault();
          var anzahl = sichtbare().length;
          if (!anzahl) { return; }
          stelle = (stelle + (ereignis.key === "ArrowDown" ? 1 : -1) + anzahl) % anzahl;
          markiere();
          return;
        }
        if (ereignis.key === "Enter") {
          ereignis.preventDefault();
          var ziel = sichtbare()[stelle];
          if (ziel) { fuehreAus(ziel); }
        }
      });
      overlay.addEventListener("mousedown", function (ereignis) {
        if (ereignis.target === overlay) { schliesse(); }
      });

      document.body.appendChild(overlay);
      markiere();
      suchfeld.focus();
    }

    function aufKuerzel(ereignis) {
      var kuerzel = (ereignis.metaKey || ereignis.ctrlKey) && !ereignis.altKey
        && String(ereignis.key).toLowerCase() === "k";
      if (!kuerzel) { return; }
      ereignis.preventDefault();
      if (overlay) { schliesse(); } else { oeffne(); }
    }

    document.addEventListener("keydown", aufKuerzel);

    // `entbinde` loest das Tastenkuerzel wieder; im Cockpit laeuft genau eine
    // Palette ueber die ganze Sitzung, die Tests brauchen den Ausstieg.
    return {
      oeffne: oeffne,
      schliesse: schliesse,
      entbinde: function () {
        schliesse();
        document.removeEventListener("keydown", aufKuerzel);
      }
    };
  }

  // ---------------------------------------------------------------------
  // Ausgang
  // ---------------------------------------------------------------------

  var ui = {
    SYMBOLE: SYMBOLE,
    symbol: symbol,
    setzeSymbol: setzeSymbol,
    segmented: segmented,
    popover: popover,
    sheet: sheet,
    schalter: schalter,
    feld: feld,
    toast: toast,
    befehlspalette: befehlspalette
  };

  var wurzel = typeof window !== "undefined" && window
    ? window
    : (typeof globalThis !== "undefined" ? globalThis : this);
  wurzel.Cockpit = wurzel.Cockpit || {};
  wurzel.Cockpit.ui = ui;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = ui;
  }
})();
