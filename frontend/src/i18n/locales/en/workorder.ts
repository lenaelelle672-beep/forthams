const workorderLocale = {
  title: 'Work Order Management',
  pageTitle: 'Work Order Form',
  typeOptions: {
    PURCHASE: 'Purchase',
    REPAIR: 'Repair',
    TRANSFER: 'Transfer',
    DISPOSAL: 'Disposal',
    OTHER: 'Other',
  },
  priorityOptions: {
    CRITICAL: 'Critical',
    HIGH: 'High',
    MEDIUM: 'Medium',
    LOW: 'Low',
  },
  priorityDescriptions: {
    CRITICAL: 'Handle immediately, impacts critical business',
    HIGH: 'Prioritize, may affect business',
    MEDIUM: 'Normal processing pace',
    LOW: 'Handle when available',
  },
  form: {
    title: 'Title',
    type: 'Type',
    priority: 'Priority',
    description: 'Description',
    estimatedCost: 'Estimated Cost',
    dueDate: 'Due Date',
    assignee: 'Assignee',
    asset: 'Related Asset',
    faultCode: 'Fault Code',
    collaborators: 'Collaborators',
    attachments: 'Attachments',
  },
  formPlaceholders: {
    title: 'Enter work order title',
    description: 'Enter description…',
    estimatedCost: '¥ 0.00',
    assignee: 'Select assignee',
    assetSearch: 'Search assets…',
  },
  validation: {
    titleMinLength: 'Title must be at least 5 characters',
    titleRequired: 'Please enter a title',
    typeRequired: 'Please select a type',
    priorityRequired: 'Please select a priority',
  },
  messages: {
    createSuccess: 'Work order created successfully',
    updateSuccess: 'Work order updated successfully',
    saveFailed: 'Failed to save work order',
    loadFailed: 'Failed to load work order data',
    submitSuccess: 'Work order submitted',
  },
  attachment: {
    uploadLabel: 'Click or drag to upload attachments',
    maxSize: 'Max 10MB per file',
    uploading: 'Uploading…',
  },
  actions: {
    submit: 'Submit',
    saveDraft: 'Save Draft',
    cancel: 'Cancel',
  },
};

export default workorderLocale;
