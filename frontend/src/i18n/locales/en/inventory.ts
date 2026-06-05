const inventoryLocale = {
  title: 'Inventory Management',
  pageTitle: 'Inventory Tasks',
  taskList: {
    title: 'Inventory Tasks',
    createTaskBtn: 'New Task',
    emptyState: 'No inventory tasks',
    columns: {
      taskName: 'Task Name',
      scopeLabel: 'Scope',
      status: 'Status',
      createdAt: 'Created At',
      progress: 'Progress',
    },
    statusFilter: {
      all: 'All',
      draft: 'Draft',
      inProgress: 'In Progress',
      completed: 'Completed',
      submitted: 'Submitted',
    },
    statusBadge: {
      draft: 'Draft',
      inProgress: 'In Progress',
      completed: 'Completed',
      submitted: 'Submitted',
    },
    scopeTypeLabel: {
      location: 'By Location',
      category: 'By Category',
      all: 'All Assets',
    },
  },
  createTaskModal: {
    title: 'New Inventory Task',
    form: {
      taskName: 'Task Name',
      taskNamePlaceholder: 'Enter task name (1-50 chars)',
      taskNameRequired: 'Please enter task name',
      scopeType: 'Scope',
      scopeRequired: 'Please select scope',
    },
    scopeTabs: {
      byLocation: 'By Location',
      byCategory: 'By Category',
      allAssets: 'All Assets',
    },
    allAssetsHint: 'All assets will be inventoried',
    actions: {
      cancel: 'Cancel',
      confirm: 'Confirm',
    },
  },
  progressSummary: {
    progressLabel: 'Progress',
    progressFormat: '{percent}%',
    statsCards: {
      totalAssets: 'Total',
      countedAssets: 'Counted',
      uncountedAssets: 'Uncounted',
      surplusAssets: 'Surplus',
      deficitAssets: 'Deficit',
    },
  },
  assetTable: {
    title: 'Asset Details',
    columns: {
      assetCode: 'Asset Code',
      assetName: 'Asset Name',
      bookStatus: 'Book Status',
      actualStatus: 'Actual Status',
      remark: 'Remark',
      actions: 'Actions',
    },
    actions: {
      markCounted: 'Mark Counted',
      markUncounted: 'Uncount',
      editRemark: 'Edit Remark',
    },
    statusBadge: {
      consistent: 'Consistent',
      surplus: 'Surplus',
      deficit: 'Deficit',
    },
  },
  submit: {
    button: 'Submit Results',
    confirmTitle: 'Confirm Submission',
    confirmMessage: 'Data will enter the review process. Are you sure?',
    success: 'Results submitted successfully',
    failed: 'Submission failed, please retry',
  },
  messages: {
    loadFailed: 'Failed to load inventory data',
    saveFailed: 'Failed to save inventory data',
    operationSuccess: 'Operation successful',
    confirmDelete: 'Are you sure you want to delete this task?',
    deleteSuccess: 'Deleted successfully',
  },
};

export default inventoryLocale;
