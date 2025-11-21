import { supabase } from './supabaseClient';
import { UserData, Report, CommercialProposal, AdCampaign, Link, StoredFile, CompanyProfile, Payment, OtherReport } from '../types';
import { initialUserData } from './mockData';

// --- ЗАГРУЗКА ВСЕХ ДАННЫХ ---
export const fetchFullUserData = async (): Promise<UserData> => {
  try {
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

// --- ФУНКЦИИ СОХРАНЕНИЯ (CRUD) С ПРОВЕРКОЙ ОШИБОК ---

// Отчеты
export const apiAddReport = async (item: Report) => {
  const { error } = await supabase.from('Reports').insert(item);
  if (error) alert(`Ошибка сохранения Отчета: ${error.message}`);
};
export const apiUpdateReport = async (item: Report) => {
  const { error } = await supabase.from('Reports').update(item).eq('id', item.id);
  if (error) console.error(error);
};
export const apiDeleteReport = async (id: string) => {
  const { error } = await supabase.from('Reports').delete().eq('id', id);
  if (error) console.error(error);
};

// Коммерческие предложения (САМОЕ ВАЖНОЕ)
export const apiAddProposal = async (item: CommercialProposal) => {
  console.log("Пытаюсь отправить КП:", item);
  // Убираем возможные undefined значения, заменяя их на null
  const cleanItem = JSON.parse(JSON.stringify(item)); 
  
  const { error } = await supabase.from('CommercialProposals').insert(cleanItem);
  
  if (error) {
      console.error("Supabase Error:", error);
      alert(`ОШИБКА СОХРАНЕНИЯ КП: ${error.message}\nПосмотрите детали в консоли (F12).`);
  } else {
      console.log("КП успешно сохранено в базе!");
  }
};
export const apiUpdateProposal = async (item: CommercialProposal) => {
  const { error } = await supabase.from('CommercialProposals').update(item).eq('id', item.id);
  if (error) console.error(error);
};
export const apiDeleteProposal = async (id: string) => {
  const { error } = await supabase.from('CommercialProposals').delete().eq('id', id);
  if (error) console.error(error);
};

// Кампании
export const apiAddCampaign = async (item: AdCampaign) => {
  const { error } = await supabase.from('AdCampaigns').insert(item);
  if (error) alert(`Ошибка сохранения Кампании: ${error.message}`);
};
export const apiDeleteCampaign = async (id: string) => {
  await supabase.from('AdCampaigns').delete().eq('id', id);
};

// Другие отчеты
export const apiAddOtherReport = async (item: OtherReport) => {
  const { error } = await supabase.from('OtherReports').insert(item);
  if (error) alert(`Ошибка: ${error.message}`);
};
export const apiUpdateOtherReport = async (item: OtherReport) => {
  await supabase.from('OtherReports').update(item).eq('id', item.id);
};
export const apiDeleteOtherReport = async (id: string) => {
  await supabase.from('OtherReports').delete().eq('id', id);
};

// Платежи
export const apiAddPayment = async (item: Payment) => {
  const { error } = await supabase.from('Payments').insert(item);
  if (error) alert(`Ошибка платежа: ${error.message}`);
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
  const { data } = await supabase.from('CompanyProfiles').select('id').single();
  if (data) {
     await supabase.from('CompanyProfiles').update(profile).eq('id', data.id);
  } else {
     await supabase.from('CompanyProfiles').insert(profile);
  }
};
