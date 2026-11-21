// A faster drop-in for csv-reader 1.0.0 (make.fun's own CSV reader).
//
// Returns exactly what csv-reader 1.0.0 returns for every input {text, header}:
// {columns, rows, errors}. Written from scratch from the reference's written
// broken-row policy (see the kit's RULES.txt); no third-party parser is used.
//
// Speed comes from scanning with indexOf instead of reading one character at a
// time: an unquoted field is located by its next comma / line feed (the next LF
// position is cached across the fields of a record), then taken as one slice;
// a quoted field is located by its closing quote the same way, then taken as
// one slice when it holds no doubled quote and no line break. The slow,
// character-at-a-time paths run only where the reference's policy needs them:
// a stray CR inside an unquoted field, a line break or doubled quote inside a
// quoted field, junk after a closing quote, and a quote that never closes.
// Every one of those paths follows the reference's order of errors and its
// line counting exactly.
//
// Pure: no clock, no randomness, no locale, nothing kept from one call to the
// next. Dependency-free ES module; no imports at all.

const COMMA = 0;
const LINE_BREAK = 1;
const END = 2;

/** csv-reader 1.0.0's answer for one case's input. */
export function run(input) {
  const text = String(input.text);
  const header = input.header === true;
  const n = text.length;
  const errors = [];
  const rows = [];
  let columns = null;
  let width = -1;

  let pos = 0; // the next character to read
  let line = 1; // the line that character is on
  if (n > 0 && text.charCodeAt(0) === 0xfeff) pos = 1;

  // Index of the next '\n' at or after pos, -1 when there is none left, -2
  // when unknown. Valid while pos <= lfPos; reset whenever pos jumps past it
  // (a quoted field, a line break, a blank-line skip).
  let lfPos = -2;

  // The record being read: the line it starts on and the index in rows it
  // takes (null: the header).
  let recordLine = 1;
  let recordRow = null;

  function pushError(code) {
    errors.push({ code, line: recordLine, row: recordRow });
  }

  // Reads unquoted characters onto `value` up to the next comma or line
  // break, exactly as the reference does: a CR not followed by LF is dropped
  // (stray_cr). Returns { value, ended, added }; `added` counts the
  // characters kept by this call. Slow path only: the fast path in the main
  // loop handles fields with no stray CR.
  function readUnquoted(value, from) {
    let added = 0;
    pos = from;
    while (pos < n) {
      const c = text.charCodeAt(pos);
      if (c === 44) { // ','
        pos += 1;
        return { value, ended: COMMA, added };
      }
      if (c === 10) { // '\n'
        pos += 1;
        line += 1;
        lfPos = -2;
        return { value, ended: LINE_BREAK, added };
      }
      if (c === 13) { // '\r'
        if (text.charCodeAt(pos + 1) === 10) {
          pos += 2;
          line += 1;
          lfPos = -2;
          return { value, ended: LINE_BREAK, added };
        }
        pushError('stray_cr');
        pos += 1;
        continue;
      }
      value += text[pos];
      added += 1;
      pos += 1;
    }
    return { value, ended: END, added };
  }

  // Normalises a quoted field's content (between its quotes): '""' becomes
  // one quote, and each CRLF or lone CR becomes LF. Returns the value and
  // how many lines the content spans (each LF, CRLF and lone CR counts one).
  function quotedValue(content, doubled) {
    let v = content;
    let lines = 0;
    if (v.indexOf('\r') !== -1) v = v.replace(/\r\n?/g, '\n');
    const m = v.indexOf('\n');
    if (m !== -1) {
      lines = 1;
      let i = v.indexOf('\n', m + 1);
      while (i !== -1) {
        lines += 1;
        i = v.indexOf('\n', i + 1);
      }
    }
    if (doubled) v = v.replaceAll('""', '"');
    return { value: v, lines };
  }

  while (true) {
    // Lines with no characters are no records.
    while (pos < n) {
      const c = text.charCodeAt(pos);
      if (c === 10) {
        pos += 1;
        line += 1;
        lfPos = -2;
      } else if (c === 13 && text.charCodeAt(pos + 1) === 10) {
        pos += 2;
        line += 1;
        lfPos = -2;
      } else {
        break;
      }
    }
    if (pos >= n) break;

    recordLine = line;
    recordRow = header && columns === null ? null : rows.length;
    const fields = [];
    let lastQuoted = false;
    let ended = COMMA;

    do {
      if (text.charCodeAt(pos) === 34) { // field opens with a quote
        lastQuoted = true;
        const open = pos;
        const openLine = line;
        // Find the closing quote: the next quote that is not doubled.
        let q = open + 1;
        let closed = -1;
        let doubled = false;
        while (true) {
          const i = text.indexOf('"', q);
          if (i === -1) break;
          if (text.charCodeAt(i + 1) === 34) {
            doubled = true;
            q = i + 2;
            continue;
          }
          closed = i;
          break;
        }
        if (closed === -1) {
          // The quote never closes: it is a literal character, and the text
          // after it is read again as unquoted.
          line = openLine;
          lfPos = -2;
          pushError('unterminated_quote');
          const r = readUnquoted('"', open + 1);
          fields.push(r.value);
          ended = r.ended;
          continue;
        }
        // Fast path: no doubled quote and no line break inside.
        const content = text.slice(open + 1, closed);
        let value;
        if (!doubled && content.indexOf('\n') === -1 && content.indexOf('\r') === -1) {
          value = content;
        } else {
          const qv = quotedValue(content, doubled);
          value = qv.value;
          line += qv.lines;
        }
        pos = closed + 1;
        // The cached next-LF stays valid when it still lies ahead of pos:
        // no '\n' can sit between the old pos and the new one then, since the
        // cached one was the first at or after the old pos. (Revision 1: this
        // avoids rescanning to the next line feed after every quoted field.)
        if (lfPos !== -1 && lfPos < pos) lfPos = -2;
        if (pos >= n) {
          fields.push(value);
          ended = END;
          continue;
        }
        const c = text.charCodeAt(pos);
        if (c === 44) {
          pos += 1;
          fields.push(value);
          ended = COMMA;
        } else if (c === 10) {
          pos += 1;
          line += 1;
          lfPos = -2;
          fields.push(value);
          ended = LINE_BREAK;
        } else if (c === 13 && text.charCodeAt(pos + 1) === 10) {
          pos += 2;
          line += 1;
          lfPos = -2;
          fields.push(value);
          ended = LINE_BREAK;
        } else {
          // What follows the closing quote is appended as it stands, up to
          // the next comma or line break.
          const junk = readUnquoted(value, pos);
          if (junk.added > 0) pushError('quote_junk');
          fields.push(junk.value);
          ended = junk.ended;
        }
      } else {
        // Unquoted field: it ends at the next comma or line feed.
        lastQuoted = false;
        if (lfPos === -2) lfPos = text.indexOf('\n', pos);
        const eComma = text.indexOf(',', pos);
        let end;
        if (eComma !== -1 && (lfPos === -1 || eComma < lfPos)) end = eComma;
        else if (lfPos !== -1) end = lfPos;
        else end = n;
        const isLFEnd = end === lfPos && lfPos !== -1;
        const crlf = isLFEnd && end > pos && text.charCodeAt(end - 1) === 13;
        const fieldEnd = crlf ? end - 1 : end;
        const value = text.slice(pos, fieldEnd);
        if (value.indexOf('\r') !== -1) {
          // A stray CR sits inside the field: read it the slow way.
          const r = readUnquoted('', pos);
          fields.push(r.value);
          ended = r.ended;
        } else if (isLFEnd) {
          pos = end + 1;
          line += 1;
          lfPos = -2;
          fields.push(value);
          ended = LINE_BREAK;
        } else if (end === eComma) {
          pos = end + 1;
          fields.push(value);
          ended = COMMA;
        } else {
          pos = n;
          fields.push(value);
          ended = END;
        }
      }
    } while (ended === COMMA);

    // A line that held only stray CRs is left with no characters: no record
    // (its stray_cr errors stay).
    if (fields.length === 1 && fields[0] === '' && !lastQuoted) continue;

    if (width < 0) width = fields.length;
    if (header && columns === null) {
      columns = fields;
      continue;
    }
    if (fields.length < width) {
      errors.push({ code: 'short_row', line: recordLine, row: recordRow, fields: fields.length });
      while (fields.length < width) fields.push('');
    } else if (fields.length > width) {
      errors.push({ code: 'long_row', line: recordLine, row: recordRow, extra: fields.splice(width) });
    }
    rows.push(fields);
  }
  return { columns: header ? (columns ?? []) : null, rows, errors };
}
