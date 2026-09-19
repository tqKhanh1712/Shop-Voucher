'use client';

import { use } from 'react';
import VoucherCampaignForm from '../../components/VoucherCampaignForm';

export default function EditVoucherPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <VoucherCampaignForm campaignId={id} />;
}
