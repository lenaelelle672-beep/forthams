import http from '@/utils/http';

export type MailGateway = {
  id: number;
  gatewayCode: string;
  gatewayName: string;
  hostMasked: string;
  port: number;
  tlsMode: string;
  authConfigured: boolean;
  senderMasked?: string;
  priority: number;
  enabled: boolean;
  lastTestStatus?: string;
  lastTestAt?: string;
  tenantScoped?: boolean;
  readOnly?: boolean;
  readonlyBoundary?: string;
};

export type MailGatewayPage = {
  records: MailGateway[];
  total: number;
  page: number;
  pageSize: number;
  pages: number;
  tenantScoped: boolean;
  readOnly: boolean;
  readonlyBoundary: string;
};

export type MailGatewayQuery = {
  page?: number;
  pageSize?: number;
  keyword?: string;
  tlsMode?: string;
  enabled?: boolean;
  authConfigured?: boolean;
};

export type MailGatewayMeta = {
  tlsModes: Array<{ value: string; label: string }>;
  lastTestStatuses: Array<{ value: string; label: string }>;
  allowedPreviewFields: string[];
  previewPolicy: {
    tenantScoped: boolean;
    noPersistence: boolean;
    noSend: boolean;
    noNetwork: boolean;
    runtimeEffect: boolean;
    cacheRefreshed: boolean;
    credentialExposed: boolean;
    smtpConnect: boolean;
    javaMailSenderUsed: boolean;
    mailSenderProviderUsed: boolean;
    readonlyBoundary?: string;
    rejectedInputFields?: string[];
  };
  tenantScoped: boolean;
  readOnly: boolean;
  noPersistencePreview: boolean;
  noSend: boolean;
  noNetwork: boolean;
  runtimeEffect: boolean;
  cacheRefreshed: boolean;
  credentialExposed: boolean;
  smtpConnect: boolean;
  javaMailSenderUsed: boolean;
  mailSenderProviderUsed: boolean;
  readonlyBoundary: string;
  nonGoals: string[];
};

export type MailGatewayPreviewRequest = {
  gatewayCode?: string;
  gatewayName?: string;
  hostMasked?: string;
  port?: number;
  tlsMode?: string;
  authConfigured?: boolean;
  senderMasked?: string;
  priority?: number;
  enabled?: boolean;
};

export type MailGatewayPreviewResponse = {
  previewAccepted: boolean;
  configured: boolean;
  acceptedFields: string[];
  rejectedInputs: Array<{ field: string; reason: string }>;
  warnings: string[];
  tenantScoped: boolean;
  readOnly: boolean;
  noPersistence: boolean;
  noSend: boolean;
  noNetwork: boolean;
  runtimeEffect: boolean;
  cacheRefreshed: boolean;
  credentialExposed: boolean;
  smtpConnect: boolean;
  javaMailSenderUsed: boolean;
  mailSenderProviderUsed: boolean;
  readonlyBoundary: string;
};

export const mailGatewayApi = {
  list(params?: MailGatewayQuery) {
    return http.get<MailGatewayPage>('/system/mail-gateways', { params });
  },
  getById(id: number) {
    return http.get<MailGateway>(`/system/mail-gateways/${id}`);
  },
  meta() {
    return http.get<MailGatewayMeta>('/system/mail-gateways/meta');
  },
  preview(data: MailGatewayPreviewRequest) {
    return http.post<MailGatewayPreviewResponse>('/system/mail-gateways/preview', data);
  },
};
