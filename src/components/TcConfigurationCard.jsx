import { useEffect, useState } from 'react';
import { FileText, Save, Users } from 'lucide-react';
import {
  getTcWorkflowSettings,
  saveTcWorkflowSettings,
} from '../services/tcRequestService.js';
import { showToast } from '../services/toast';

const DEFAULT_WORKFLOW = {
  managementApproval: 'required',
  tcMethod: 'generate',
};

function RadioOption({ name, value, checked, onChange, label }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-800">
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={() => onChange(value)}
        className="h-4 w-4 accent-blue-600"
      />
      {label}
    </label>
  );
}

function ConfigRow({ icon: Icon, iconWrap, title, description, help, children }) {
  return (
    <div className="grid grid-cols-1 gap-4 border-b border-gray-200 px-6 py-5 lg:grid-cols-[minmax(0,1.4fr)_auto_minmax(0,1fr)] lg:items-center lg:gap-8">
      <div className="flex items-start gap-3">
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${iconWrap}`}>
          <Icon size={20} />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900">{title}</p>
          <p className="mt-0.5 text-sm text-gray-500">{description}</p>
        </div>
      </div>
      <div className="flex flex-col gap-2.5 lg:min-w-[11rem]">{children}</div>
      <p className="text-sm leading-relaxed text-gray-500 lg:text-right">{help}</p>
    </div>
  );
}

export default function TcConfigurationCard() {
  const [managementApproval, setManagementApproval] = useState(DEFAULT_WORKFLOW.managementApproval);
  const [tcMethod, setTcMethod] = useState(DEFAULT_WORKFLOW.tcMethod);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await getTcWorkflowSettings();
        if (cancelled) return;
        setManagementApproval(data?.managementApproval || DEFAULT_WORKFLOW.managementApproval);
        setTcMethod(data?.tcMethod || DEFAULT_WORKFLOW.tcMethod);
      } catch {
        // keep defaults
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const onSave = async () => {
    setSaving(true);
    try {
      const saved = await saveTcWorkflowSettings({ managementApproval, tcMethod });
      setManagementApproval(saved?.managementApproval || managementApproval);
      setTcMethod(saved?.tcMethod || tcMethod);
      showToast('TC configuration saved', 'success');
    } catch (err) {
      showToast(err.message || 'Could not save TC configuration', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <h3 className="border-b border-gray-200 px-6 py-4 text-lg font-bold text-gray-900">
        TC Configuration
      </h3>

      {loading ? (
        <p className="px-6 py-8 text-sm text-gray-500">Loading…</p>
      ) : (
        <>
          <ConfigRow
            icon={Users}
            iconWrap="bg-violet-100 text-violet-700"
            title="Management Approval"
            description="Choose whether management approval is required in the TC workflow."
            help="If required, the request will be sent to management for approval."
          >
            <RadioOption
              name="tc-approval"
              value="required"
              checked={managementApproval === 'required'}
              onChange={setManagementApproval}
              label="Required"
            />
            <RadioOption
              name="tc-approval"
              value="not_required"
              checked={managementApproval === 'not_required'}
              onChange={setManagementApproval}
              label="Not Required"
            />
          </ConfigRow>

          <ConfigRow
            icon={FileText}
            iconWrap="bg-emerald-100 text-emerald-700"
            title="TC Method"
            description="Choose how the TC will be prepared."
            help={
              tcMethod === 'upload'
                ? 'If Upload TC is selected, staff will attach a prepared TC file.'
                : tcMethod === 'both'
                  ? 'Staff can generate a TC from student details or upload a prepared file.'
                  : 'If Generate TC is selected, the system will create TC using student details.'
            }
          >
            <RadioOption
              name="tc-method"
              value="generate"
              checked={tcMethod === 'generate'}
              onChange={setTcMethod}
              label="Generate TC"
            />
            <RadioOption
              name="tc-method"
              value="upload"
              checked={tcMethod === 'upload'}
              onChange={setTcMethod}
              label="Upload TC"
            />
            <RadioOption
              name="tc-method"
              value="both"
              checked={tcMethod === 'both'}
              onChange={setTcMethod}
              label="Both"
            />
          </ConfigRow>

          <div className="flex justify-center px-6 py-5">
            <button
              type="button"
              disabled={saving}
              onClick={onSave}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
            >
              <Save size={16} />
              {saving ? 'Saving…' : 'Save Configuration'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
