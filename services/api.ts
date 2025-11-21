import { supabase } from './supabaseClient';
import { UserData, Report, CommercialProposal, AdCampaign, Link, StoredFile, CompanyProfile, Payment, OtherReport } from '../types';
import { initialUserData } from './mockData';

// --- ЗАГРУЗКА ВСЕХ ДАННЫХ ---
export const fetchFullUserData = async (): Promise<UserData> => {
  try {
    // Загружаем всё параллельно для скорости
    const [
      profileRes, reportsRes, proposalsRes, campaignsRes, 
      linksRes, filesRes, paymentsRes, otherReportsRes
    ] = await Promise.all([
      supabase.from('CompanyProfiles').select('*').single(),
      supabase.from('Reports').select('*').order('creationDate', { ascending: false }),
      supabase.from('CommercialProposals').select('*').order('date', { ascending: false }),
      supabase.from('AdCampaigns').select('*'),
      supabase.from('Links').select('*'),
      supabase.from('StoredFiles').select('*'),
      supabase.from('Payments').select('*'),
      supabase.from('OtherReports').select('*')
    ]);

    // Собираем результат
    return {
      companyProfile: profileRes.data ? profileRes.data : initialUserData.companyProfile,
      reports: reportsRes.data || [],
      proposals: proposalsRes.data || [],
      campaigns: campaignsRes.data || [],
      links: linksRes.data || [],
      files: filesRes.data || [],
      payments: paymentsRes.data || [],
      otherReports: otherReportsRes.data || [],
    };
  } catch (error) {
    console.error('Ошибка при загрузке из Supabase:', error);
    return initialUserData;
  }
};

// --- ФУНКЦИИ СОХРАНЕНИЯ (CRUD) ---

// Отчеты
export const apiAddReport = async (item: Report) => {
  await supabase.from('Reports').insert(item);
};
export const apiUpdateReport = async (item: Report) => {
  await supabase.from('Reports').update(item).eq('id', item.id);
};
export const apiDeleteReport = async (id: string) => {
  await supabase.from('Reports').delete().eq('id', id);
};

// Коммерческие предложения
export const apiAddProposal = async (item: CommercialProposal) => {
  await supabase.from('CommercialProposals').insert(item);
};
export const apiUpdateProposal = async (item: CommercialProposal) => {
  await supabase.from('CommercialProposals').update(item).eq('id', item.id);
};
export const apiDeleteProposal = async (id: string) => {
  await supabase.from('CommercialProposals').delete().eq('id', id);
};

// Кампании
export const apiAddCampaign = async (item: AdCampaign) => {
  await supabase.from('AdCampaigns').insert(item);
};
export const apiDeleteCampaign = async (id: string) => {
  await supabase.from('AdCampaigns').delete().eq('id', id);
};

// Другие отчеты
export const apiAddOtherReport = async (item: OtherReport) => {
  await supabase.from('OtherReports').insert(item);
};
export const apiUpdateOtherReport = async (item: OtherReport) => {
  await supabase.from('OtherReports').update(item).eq('id', item.id);
};
export const apiDeleteOtherReport = async (id: string) => {
  await supabase.from('OtherReports').delete().eq('id', id);
};

// Платежи
export const apiAddPayment = async (item: Payment) => {
  await supabase.from('Payments').insert(item);
};
export const apiUpdatePayment = async (item: Payment) => {
  await supabase.from('Payments').update(item).eq('id', item.id);
};
export const apiDeletePayment = async (id: string) => {
  await supabase.from('Payments').delete().eq('id', id);
};

// Ссылки и Файлы
export const apiAddLink = async (item: Link) => {
  await supabase.from('Links').insert(item);
};
export const apiDeleteLink = async (id: string) => {
  await supabase.from('Links').delete().eq('id', id);
};
export const apiAddFile = async (item: StoredFile) => {
  await supabase.from('StoredFiles').insert(item);
};
export const apiDeleteFile = async (id: string) => {
  await supabase.from('StoredFiles').delete().eq('id', id);
};

// Профиль компании
export const apiUpdateCompanyProfile = async (profile: CompanyProfile) => {
  // Проверяем, есть ли запись. Если нет — создаем.
  const { data } = await supabase.from('CompanyProfiles').select('id').single();
  
  if (data) {
     await supabase.from('CompanyProfiles').update(profile).eq('id', data.id);
  } else {
     await supabase.from('CompanyProfiles').insert(profile);
  }
};
