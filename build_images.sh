docker build -t nhex2/ts -f TS_Dockerfile .
docker build -t nhex2/tss -f TSS_Dockerfile .
docker build -t nhex2/tm -f TM_Dockerfile .
docker build -t nhex2/users -f Users_Dockerfile .
docker build -t nhex2/main -f Main_Dockerfile .
docker build -t nhex2/proxy -f Nginx_Dockerfile .