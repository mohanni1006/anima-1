'use strict';

const config = {
  endpoint: 'https://anima-1-webhook.mohanni1006.workers.dev/',
  notificationsEnabled: true // 알림 활성화
};

// 팝업 제어
const popup = document.querySelector('#welcome');
function closePopup() {
  if (popup && popup.open) popup.close();
  document.body.classList.remove('modal');
}

if (popup) {
  document.querySelector('#close')?.addEventListener('click', closePopup);
  document.querySelector('#popup-reserve')?.addEventListener('click', closePopup);
  popup.addEventListener('close', () => document.body.classList.remove('modal'));

  // 팝업 바깥 배경 클릭 시 닫기
  popup.addEventListener('click', (e) => {
    const rect = popup.getBoundingClientRect();
    const isInDialog = (
      rect.top <= e.clientY &&
      e.clientY <= rect.top + rect.height &&
      rect.left <= e.clientX &&
      e.clientX <= rect.left + rect.width
    );
    if (!isInDialog) closePopup();
  });

  try {
    popup.showModal();
    document.body.classList.add('modal');
  } catch (err) {}
}

// 오늘 날짜 이전 선택 방지
const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(new Date());
const dateInput = document.querySelector('[name=date]');
if (dateInput) dateInput.min = today;

// Worker 전송 공통 함수
async function notifyWorker(discordPayload, smsPayload = null) {
  const response = await fetch(config.endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ discordPayload, smsPayload }),
    signal: AbortSignal.timeout(15000)
  });

  const result = await response.json();
  if (!response.ok || result.success !== true) {
    throw new Error(result.error || '알림 전송 실패');
  }
  return result;
}

// 1. 홈페이지 접속 시 디스코드 방문 알림 (세션당 1회 발송)
if (config.notificationsEnabled) {
  try {
    if (!sessionStorage.getItem('anima-visit-recorded')) {
      sessionStorage.setItem('anima-visit-recorded', 'true');

      const now = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
      const referrer = document.referrer || '직접 접속 (URL 직접 입력 / 북마크)';
      const isMobile = /Mobi|Android|iPhone/i.test(navigator.userAgent) ? '모바일 (Mobile)' : 'PC / 데스크톱';

      const discordPayload = {
        username: '아니마 트래킹봇',
        embeds: [
          {
            title: '🐾 [방문 알림] 새로운 방문자가 접속했습니다',
            color: 0x163e32, // 다크 그린
            fields: [
              { name: '접속 일시', value: now, inline: true },
              { name: '접속 환경', value: isMobile, inline: true },
              { name: '유입 경로', value: referrer, inline: false },
              { name: '페이지 주소', value: location.href, inline: false }
            ],
            footer: { text: 'ANIMA POOL TERRACE · 실시간 방문 감지' }
          }
        ]
      };

      // 방문 시에는 문자를 보내지 않으므로 smsPayload는 null
      notifyWorker(discordPayload, null).catch(() => {});
    }
  } catch (e) {}
}

// 2. 방문상담 예약 제출 (디스코드 + 문자 동시 발송)
const bookingForm = document.querySelector('#booking');
if (bookingForm) {
  bookingForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const status = document.querySelector('#status');

    if (!form.reportValidity()) return;

    const data = Object.fromEntries(new FormData(form));
    data.phone = data.phone.replace(/\D/g, '');
    data.name = data.name.trim();

    if (!data.name || !/^01[016789]\d{7,8}$/.test(data.phone) || data.date < today) {
      status.textContent = '성함, 연락처와 방문 희망일을 올바르게 확인해 주세요.';
      status.style.color = '#ff9999';
      return;
    }

    const formattedPhone = data.phone.replace(/^(\d{3})(\d{3,4})(\d{4})$/, '$1-$2-$3');
    const now = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });

    // 디스코드용 Embed 카드 페이로드
    const discordPayload = {
      username: '아니마 예약 알림봇',
      embeds: [
        {
          title: '🎉 [예약 접수] 새로운 방문상담 신청이 도착했습니다!',
          color: 0xc8ad79, // 골드
          fields: [
            { name: '고객 성함', value: data.name, inline: true },
            { name: '연락처', value: formattedPhone, inline: true },
            { name: '방문 희망일', value: data.date, inline: true },
            { name: '희망 시간', value: data.time || '시간 협의', inline: true },
            { name: '관심 상품', value: data.interest || '상담 후 결정', inline: true },
            { name: '접수 일시', value: now, inline: true },
            { name: '문의사항', value: data.message ? `\`\`\`\n${data.message}\n\`\`\`` : '없음', inline: false }
          ],
          footer: { text: 'ANIMA POOL TERRACE · 방문상담 예약' }
        }
      ]
    };

    // 문자(SMS) 웹훅용 페이로드 (규격에 유연하게 대응하도록 주요 키 모두 포함)
    const smsText = `[아니마 풀 테라스] 방문상담 예약 신청\n- 성함: ${data.name}\n- 연락처: ${formattedPhone}\n- 희망일시: ${data.date} (${data.time})\n- 상품: ${data.interest}\n- 문의: ${data.message || '없음'}`;
    const smsPayload = {
      phone: data.phone,
      to: data.phone,
      receiver: data.phone,
      name: data.name,
      message: smsText,
      msg: smsText,
      text: smsText,
      date: data.date,
      time: data.time,
      interest: data.interest,
      inquiry: data.message || ''
    };

    const button = form.querySelector('button');
    button.disabled = true;
    status.textContent = '예약 내용을 전송하고 있습니다…';
    status.style.color = 'var(--gold)';

    try {
      await notifyWorker(discordPayload, smsPayload);
      status.textContent = '방문상담 신청이 정상적으로 접수되었습니다. 담당자가 확인 후 연락드리겠습니다.';
      status.style.color = '#8ae39f';
      form.reset();
    } catch (err) {
      console.error(err);
      status.textContent = '접수 결과를 전송하지 못했습니다. 대표번호(1551-7889) 또는 문자(010-3950-8060)로 문의해 주세요.';
      status.style.color = '#ff9999';
    } finally {
      button.disabled = false;
    }
  });
}
