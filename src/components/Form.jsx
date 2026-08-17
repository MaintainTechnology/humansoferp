'use client';

// Replaces Forminator. Field schema, required flags, options and conditional
// logic all come from the WordPress export, so the forms ask exactly what they
// asked before. Validation runs client-side for feedback and again on the
// server, which is the only side that counts.

import { useState, useId } from 'react';

function visible(field, values) {
  if (!field.conditions?.length) return true;
  const test = (c) => {
    const v = values[c.field];
    switch (c.rule) {
      case 'is': return String(v ?? '') === String(c.value);
      case 'is_not': return String(v ?? '') !== String(c.value);
      case 'contains': return String(v ?? '').includes(String(c.value));
      case 'not_contains': return !String(v ?? '').includes(String(c.value));
      case 'is_empty': return !v;
      case 'is_not_empty': return !!v;
      default: return true;
    }
  };
  const met = field.conditionRule === 'any' ? field.conditions.some(test) : field.conditions.every(test);
  return field.conditionAction === 'hide' ? !met : met;
}

const TYPE_ATTRS = {
  email: { type: 'email', autoComplete: 'email', inputMode: 'email' },
  phone: { type: 'tel', autoComplete: 'tel', inputMode: 'tel' },
  url: { type: 'url', inputMode: 'url' },
  number: { type: 'number', inputMode: 'numeric' },
  name: { type: 'text', autoComplete: 'name' },
  text: { type: 'text' },
};

export default function Form({ form }) {
  const uid = useId();
  const initial = () =>
    Object.fromEntries(
      form.fields.map((f) => {
        if (f.type === 'consent') return [f.id, false];
        // Radio/select options can carry a pre-selected default; the branch
        // shown on first paint depends on it.
        const preset = f.options?.find((o) => o.default);
        return [f.id, preset ? (preset.value ?? preset.label) : ''];
      })
    );

  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState({});
  const [state, setState] = useState({ status: 'idle', message: '' });

  // Forminator puts every field in the DOM and hides the inactive ones, so the
  // markup matches the original and the form still degrades without JS.
  // `shown` is what actually gets validated and submitted.
  const isShown = (f) => visible(f, values);
  const shown = form.fields.filter(isShown);
  const set = (id, v) => {
    setValues((prev) => ({ ...prev, [id]: v }));
    setErrors((prev) => (prev[id] ? { ...prev, [id]: null } : prev));
  };

  function validate() {
    const next = {};
    for (const f of shown) {
      const v = values[f.id];
      if (f.required && (v === '' || v == null || v === false)) {
        next[f.id] = `${f.label || 'This field'} is required`;
        continue;
      }
      if (!v) continue;
      if (f.type === 'email' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(v))) next[f.id] = 'Enter a valid email address';
      if (f.type === 'url' && !/^https?:\/\/\S+$/i.test(String(v))) next[f.id] = 'Enter a full URL starting with http';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function onSubmit(e) {
    e.preventDefault();
    if (!validate()) {
      setState({ status: 'idle', message: '' });
      return;
    }
    setState({ status: 'sending', message: '' });
    try {
      const payload = Object.fromEntries(shown.map((f) => [f.id, values[f.id]]));
      const res = await fetch('/api/forms', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ formId: form.id, values: payload }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (body.fieldErrors) setErrors(body.fieldErrors);
        throw new Error(body.error || 'Something went wrong. Please try again.');
      }
      setState({ status: 'ok', message: form.thankYou });
      setValues(initial());
    } catch (err) {
      setState({ status: 'error', message: err.message });
    }
  }

  if (state.status === 'ok') {
    return (
      <div className="mt-form__status" data-state="ok" role="status">
        {state.message}
      </div>
    );
  }

  return (
    <form className="mt-form" onSubmit={onSubmit} noValidate>
      {form.fields.map((f) => {
        const id = `${uid}-${f.id}`;
        const err = errors[f.id];
        const described = err ? `${id}-err` : undefined;
        const active = isShown(f);
        const common = {
          id,
          name: f.id,
          required: f.required && active,
          disabled: !active,
          'aria-invalid': err ? 'true' : undefined,
          'aria-describedby': described,
        };

        let control;
        if (f.type === 'textarea') {
          control = <textarea {...common} placeholder={f.placeholder} value={values[f.id]} onChange={(e) => set(f.id, e.target.value)} />;
        } else if (f.type === 'select') {
          control = (
            <select {...common} value={values[f.id]} onChange={(e) => set(f.id, e.target.value)}>
              {(f.options || []).map((o, i) => (
                <option key={o.value ?? i} value={i === 0 && !o.value ? '' : o.value ?? o.label}>
                  {o.label}
                </option>
              ))}
            </select>
          );
        } else if (f.type === 'radio') {
          control = (
            <div role="radiogroup" aria-labelledby={`${id}-label`} className="mt-field__radios">
              {(f.options || []).map((o, i) => (
                <label key={o.value ?? i} className="mt-radio">
                  <input
                    type="radio"
                    name={f.id}
                    value={o.value ?? o.label}
                    checked={values[f.id] === (o.value ?? o.label)}
                    onChange={(e) => set(f.id, e.target.value)}
                  />
                  <span>{o.label}</span>
                </label>
              ))}
            </div>
          );
        } else if (f.type === 'consent') {
          return (
            <div className="mt-field mt-field--consent" key={f.id} hidden={!active}>
              <span className="mt-field__group-label" id={`${id}-label`}>{f.label}</span>
              <input
                {...common}
                type="checkbox"
                checked={!!values[f.id]}
                onChange={(e) => set(f.id, e.target.checked)}
              />
              {/* Consent wording is authored HTML (it links the privacy policy). */}
              <label htmlFor={id}>
                <span dangerouslySetInnerHTML={{ __html: f.description || 'I agree to be contacted about my enquiry.' }} />
                {f.required ? ' *' : ''}
              </label>
              {err && <p className="mt-form__error" id={`${id}-err`}>{err}</p>}
            </div>
          );
        } else if (f.type === 'upload') {
          // Native file inputs render inconsistently across browsers, so this
          // mirrors what Forminator showed: a labelled button plus the chosen
          // file name and a way to clear it.
          const chosen = values[f.id];
          control = (
            <div className="mt-upload">
              <label className="mt-upload__btn" htmlFor={id}>Choose File</label>
              <input
                {...common}
                type="file"
                className="mt-upload__input"
                accept={f.fileTypes || '.pdf,.doc,.docx'}
                onChange={(e) => set(f.id, e.target.files?.[0]?.name || '')}
              />
              <span className="mt-upload__name">{chosen || 'No file chosen'}</span>
              {chosen && (
                <button type="button" className="mt-upload__clear" onClick={() => set(f.id, '')}>
                  Delete
                </button>
              )}
              <span className="mt-upload__hint">
                Max upload size {f.uploadLimit || 10}
                {f.fileSize || 'MB'}. Files are uploaded when you submit.
              </span>
            </div>
          );
        } else {
          control = (
            <input
              {...common}
              {...(TYPE_ATTRS[f.type] || TYPE_ATTRS.text)}
              placeholder={f.placeholder}
              value={values[f.id]}
              onChange={(e) => set(f.id, e.target.value)}
            />
          );
        }

        return (
          <div className="mt-field" key={f.id} hidden={!active}>
            <label htmlFor={id} id={`${id}-label`}>
              {f.label}
              {f.required ? ' *' : ''}
            </label>
            {control}
            {f.description && f.description !== f.label && (
              <p className="mt-field__hint">{f.description}</p>
            )}
            {err && <p className="mt-form__error" id={`${id}-err`}>{err}</p>}
          </div>
        );
      })}

      <button type="submit" disabled={state.status === 'sending'}>
        {state.status === 'sending' ? 'Sendingâ€¦' : form.submitLabel}
      </button>

      {state.status === 'error' && (
        <p className="mt-form__status" data-state="error" role="alert">{state.message}</p>
      )}
    </form>
  );
}

