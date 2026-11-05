# Melhorias previstas

Status: registradas para implementação futura. Nenhuma alteração funcional nesta etapa.

## Entrega da senha configurável

- Escolher nas configurações de cada cliente entre impressão automática após a emissão e exibição da senha na tela do tablet.
- No modo de tela, mostrar o número emitido sem exigir impressão.
- No modo automático, imprimir pela impressora configurada. Equipamento de teste: Tomate MTI-773, conexão Bluetooth.
- Em falha de impressão, permitir reimprimir a mesma senha sem gerar novo número.

## Reinício diário com histórico preservado

- Reiniciar a sequência a cada dia, respeitando o fuso horário da instalação (piloto: America/Bahia), inclusive ao retomar após um período desligado.
- Preservar os registros dos dias anteriores para relatórios futuros. Reiniciar a sequência não deve apagar nem sobrescrever o histórico.
- Identificar cada registro por instalação, data e identificador único, permitindo que o número visível se repita em dias diferentes.
- Guardar serviço, guichê, situação e horários de emissão, chamada e conclusão para consultas e relatórios por período.
- Revisar a retenção atual: o histórico dos relatórios deve ter armazenamento próprio e não depender do limite de registros da fila operacional.

Validação prevista: emissão em cada modo, reimpressão sem duplicidade, virada de dia e retomada após parada com histórico anterior íntegro.
